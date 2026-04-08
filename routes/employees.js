const express = require("express");
const router = express.Router();
const { Employee } = require("../models");
const { Op } = require("sequelize");

// ============================================
// GET all employees
// ============================================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (err) {
    console.error("Get employees error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// CREATE new employee
// ============================================
router.post("/", async (req, res) => {
  try {
    const employee = await Employee.create(req.body);

    console.log("✅ Employee created:", {
      username: employee.username,
      passwordLength: employee.password.length,
      isHashed: employee.password.startsWith("$2"),
    });

    // Remove password from response
    const response = employee.toJSON();
    delete response.password;

    res.status(201).json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("Employee creation error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "Failed to create employee",
    });
  }
});

// ============================================
// UPDATE employee
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Update fields
    await employee.update(req.body);

    console.log("✅ Employee updated:", employee.username);

    // Remove password from response
    const response = employee.toJSON();
    delete response.password;

    res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("Employee update error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "Failed to update employee",
    });
  }
});

// ============================================
// DELETE employee
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    await employee.destroy();

    console.log("✅ Employee deleted:", employee.username);

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during deletion",
    });
  }
});

// ============================================
// PAY SALARY
// ============================================
router.patch("/:id/pay-salary", async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    if (employee.lastPaidMonth === currentMonth) {
      return res.status(400).json({
        success: false,
        message: "Salary already paid for this month",
      });
    }

    // Update salary history (stored as JSON)
    const salaryHistory = employee.salaryHistory || [];
    salaryHistory.push({
      amount: employee.salary,
      paidDate: new Date(),
      month: currentMonth,
      status: "paid",
    });

    await employee.update({
      salaryHistory,
      lastPaidMonth: currentMonth,
      salaryStatus: "paid"
    });

    // Remove password from response
    const response = employee.toJSON();
    delete response.password;

    return res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("Pay salary error:", err.stack || err);
    return res.status(500).json({
      success: false,
      message: "Failed to process salary payment",
      error: err.message,
    });
  }
});

module.exports = router;