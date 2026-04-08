const express = require("express");
const router = express.Router();
const { Notification, ShopSettings } = require("../models");
const { sendEmail } = require("../services/emailService");
const { Op } = require("sequelize");

const EMAIL_TYPES = [
  "low-stock",
  "new-credit",
  "employee-added",
  "salary-paid",
  "credit-due",
];

// POST new notification
router.post("/", async (req, res) => {
  try {
    const { type, message, emailData } = req.body;

    if (!type || !message) {
      return res.status(400).json({ message: "Type and message required" });
    }

    // Check if this type should send email
    const shouldSendEmail = EMAIL_TYPES.includes(type);

    const notification = await Notification.create({
      type,
      message,
      isRead: false,
      sendEmail: shouldSendEmail,
      emailData: emailData || {},
      emailSent: false,
    });

    // Send email if required
    if (shouldSendEmail) {
      // Get owner email from shop settings
      const shopSettings = await ShopSettings.findOne();
      const ownerEmail = shopSettings?.email;

      if (ownerEmail) {
        console.log(`📧 Sending email to owner: ${ownerEmail}`);
        const emailResult = await sendEmail(ownerEmail, type, emailData || {});

        // Update notification with email status
        await notification.update({ emailSent: emailResult.success });
      } else {
        console.log("⚠️ No owner email found in shop settings");
      }
    }

    res.status(201).json(notification);
  } catch (err) {
    console.error("POST error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET all notifications
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    // console.log(`[GET] Loaded ${notifications.length} notifications`);

    // Log read/unread status
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    // console.log(
    //   `[GET] Unread: ${unreadCount}, Read: ${notifications.length - unreadCount}`,
    // );

    res.json(notifications);
  } catch (err) {
    console.error("GET error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark all as read
router.patch("/mark-all-read", async (req, res) => {
  try {
    // console.log("\n========== MARK ALL AS READ ==========");

    // Check BEFORE update
    const beforeUnread = await Notification.count({ 
      where: { isRead: false } 
    });
    // console.log("BEFORE: Unread count:", beforeUnread);

    // Get sample before
    const sampleBefore = await Notification.findOne({ 
      where: { isRead: false } 
    });
    if (sampleBefore) {
      // console.log("Sample BEFORE:", {
      //   id: sampleBefore.id,
      //   isRead: sampleBefore.isRead,
      // });
    }

    // Perform update
    const [updatedCount] = await Notification.update(
      { isRead: true },
      { where: {} }
    );

    // console.log("Update result:", {
    //   modified: updatedCount,
    // });

    // Check AFTER update
    const afterUnread = await Notification.count({ 
      where: { isRead: false } 
    });
    // console.log("AFTER: Unread count:", afterUnread);

    // Get the same sample after
    if (sampleBefore) {
      const sampleAfter = await Notification.findByPk(sampleBefore.id);
      // console.log("Sample AFTER:", {
      //   id: sampleAfter.id,
      //   isRead: sampleAfter.isRead,
      // });
    }

    console.log("======================================\n");

    res.json({
      success: true,
      message: "All marked as read",
      beforeUnread,
      afterUnread,
      modified: updatedCount,
    });
  } catch (err) {
    console.error("[PATCH /mark-all-read] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Mark multiple as read
router.patch("/mark-read", async (req, res) => {
  try {
    const { ids } = req.body;
    // console.log(`[PATCH /mark-read] Request to mark ${ids?.length} notifications`);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array required" });
    }

    const [updatedCount] = await Notification.update(
      { isRead: true },
      { where: { id: ids } }
    );

    // console.log(`[PATCH /mark-read] Modified: ${updatedCount}`);

    res.json({
      success: true,
      message: "Marked as read",
      count: updatedCount,
    });
  } catch (err) {
    console.error("[PATCH /mark-read] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Mark single as read
router.patch("/:id", async (req, res) => {
  try {
    // console.log(`[PATCH /:id] Marking ${req.params.id}`);

    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notification.update({ isRead: true });

    // console.log(`[PATCH /:id] Success. isRead: ${notification.isRead}`);
    res.json(notification);
  } catch (err) {
    console.error("[PATCH /:id] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Clear all
router.delete("/clear-all", async (req, res) => {
  try {
    const deletedCount = await Notification.destroy({ where: {} });
    // console.log(`[DELETE /clear-all] Deleted ${deletedCount}`);
    res.json({ message: "All cleared", count: deletedCount });
  } catch (err) {
    console.error("[DELETE /clear-all] Error:", err);
    res.status(500).json({ message: "Clear failed" });
  }
});

// Delete one
router.delete("/:id", async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    
    await notification.destroy();
    // console.log(`[DELETE /:id] Deleted ${req.params.id}`);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("[DELETE /:id] Error:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// TEMPORARY DEBUG
router.get("/debug", async (req, res) => {
  try {
    const all = await Notification.findAll();
    const stats = {
      total: all.length,
      unread: all.filter((n) => n.isRead === false).length,
      read: all.filter((n) => n.isRead === true).length,
      noIsReadField: all.filter(
        (n) => n.isRead === undefined || n.isRead === null,
      ).length,
      sample: all.slice(0, 3).map((n) => ({
        id: n.id,
        message: n.message.substring(0, 30),
        isRead: n.isRead,
        isReadType: typeof n.isRead,
      })),
    };
    res.json(stats);
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;