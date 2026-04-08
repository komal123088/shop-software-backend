const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Owner, Employee } = require("../models");
const { JWT_SECRET } = require("../env");
const { Op } = require("sequelize");

// ============================================
//  EMAIL TRANSPORTER SETUP
// ============================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ============================================
//  OWNER REGISTRATION (One-time only)
// ============================================
router.post("/owner/register", async (req, res) => {
  try {
    const { name, email, password, phone, shopName } = req.body;

    // Check if owner already exists
    const existingOwner = await Owner.findOne();
    if (existingOwner) {
      return res.status(403).json({
        message: "Owner already registered. Only one owner allowed.",
      });
    }

    // Create owner
    const owner = await Owner.create({
      name,
      email,
      password,
      phone,
      shopName,
      isRegistered: true,
      tokenVersion: 0,
    });

    // Generate token with tokenVersion
    const token = jwt.sign(
      {
        id: owner.id,
        role: "owner",
        isOwner: true,
        tokenVersion: owner.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.status(201).json({
      message: "Owner registered successfully",
      token,
      user: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: "owner",
        isOwner: true,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
//  OWNER LOGIN
// ============================================
router.post("/owner/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find owner
    const owner = await Owner.findOne({ where: { email } });
    if (!owner) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await owner.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token with tokenVersion
    const token = jwt.sign(
      {
        id: owner.id,
        role: "owner",
        isOwner: true,
        tokenVersion: owner.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: "owner",
        isOwner: true,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
//  EMPLOYEE LOGIN
// ============================================
router.post("/employee/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("Login attempt:", { username });

    // Find employee
    const employee = await Employee.findOne({ 
      where: { username: username.trim() } 
    });

    if (!employee) {
      console.log("Employee not found:", username);
      return res.status(401).json({
        message: "Invalid credentials",
        debug: "Username not found",
      });
    }

    // Check if active
    if (!employee.isActive) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // Check password
    const isMatch = await employee.comparePassword(password);

    if (!isMatch) {
      console.log("Password mismatch for:", username);
      return res.status(401).json({
        message: "Invalid credentials",
        debug: "Password incorrect",
      });
    }

    console.log("Login successful:", username);

    // Generate token
    const token = jwt.sign(
      {
        id: employee.id,
        role: employee.role,
        isOwner: false,
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role: employee.role,
        isOwner: false,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
//  CHECK IF OWNER EXISTS (For frontend)
// ============================================
router.get("/owner/exists", async (req, res) => {
  try {
    const owner = await Owner.findOne();
    res.json({ exists: !!owner });
  } catch (err) {
    console.error("Owner exists check error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// DEBUG: Get all employees
// ============================================
router.get("/debug/employees", async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: ['username', 'role', 'name']
    });
    
    res.json({
      count: employees.length,
      employees: employees.map((emp) => ({
        username: emp.username,
        role: emp.role,
        name: emp.name,
      })),
    });
  } catch (err) {
    console.error("Debug employees error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
//  FORGOT PASSWORD - REQUEST RESET CODE
// ============================================
router.post("/owner/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const owner = await Owner.findOne({ where: { email } });
    if (!owner) {
      return res.status(404).json({
        message: "No account found with this email address",
      });
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiry (15 minutes)
    owner.resetPasswordCode = resetCode;
    owner.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await owner.save();

    // Send email with code
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `${owner.shopName || "Shop"} - Password Reset Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #FFC107; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <p style="font-size: 16px; color: #333;">Hello ${owner.name},</p>
            
            <p style="font-size: 14px; color: #666;">
              We received a request to reset your password. Use the code below to proceed:
            </p>
            
            <div style="background-color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px dashed #FFC107;">
              <h1 style="color: #FFC107; letter-spacing: 8px; margin: 0; font-size: 36px;">
                ${resetCode}
              </h1>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message: "Password reset code has been sent to your email",
      email: email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({
      message: "Failed to send reset code. Please try again later.",
      error: err.message,
    });
  }
});

// ============================================
//  VERIFY RESET CODE
// ============================================
router.post("/owner/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    const owner = await Owner.findOne({
      where: {
        email,
        resetPasswordCode: code,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!owner) {
      return res.status(400).json({
        message: "Invalid or expired verification code",
      });
    }

    // Generate temporary reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      {
        id: owner.id,
        purpose: "password-reset",
        code: code,
      },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({
      message: "Code verified successfully",
      resetToken,
    });
  } catch (err) {
    console.error("Verify code error:", err);
    res.status(500).json({
      message: "Verification failed. Please try again.",
      error: err.message,
    });
  }
});

// ============================================
//  RESET PASSWORD - ✅ INVALIDATES ALL SESSIONS
// ============================================
router.post("/owner/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(400).json({
        message: "Invalid reset token",
      });
    }

    // Find owner
    const owner = await Owner.findByPk(decoded.id);
    if (!owner) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify the code is still valid
    if (!owner.resetPasswordCode || owner.resetPasswordExpires < new Date()) {
      return res.status(400).json({
        message: "Reset session has expired. Please request a new code.",
      });
    }

    // Update password
    owner.password = newPassword;

    // ✅ INCREMENT TOKEN VERSION - This invalidates all existing tokens
    owner.tokenVersion = (owner.tokenVersion || 0) + 1;

    // Clear reset fields
    owner.resetPasswordCode = null;
    owner.resetPasswordExpires = null;

    await owner.save();

    // Send confirmation email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: owner.email,
        subject: `${owner.shopName || "Shop"} - Password Changed Successfully`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #28a745; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Password Changed</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <p style="font-size: 16px; color: #333;">Hello ${owner.name},</p>
              
              <p style="font-size: 14px; color: #666;">
                Your password has been successfully changed. All your previous sessions have been logged out for security.
              </p>
              
              <p style="font-size: 14px; color: #666;">
                If you did not make this change, please contact support immediately.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/owner-login" 
                   style="background-color: #FFC107; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Login to Your Account
                </a>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
    }

    res.json({
      message:
        "Password has been reset successfully. Please login again with your new password.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      message: "Failed to reset password. Please try again.",
      error: err.message,
    });
  }
});

module.exports = router;