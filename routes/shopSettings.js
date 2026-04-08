const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { ShopSettings } = require("../models");

// Multer setup for logo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, "logo" + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// GET current shop settings
router.get("/", async (req, res) => {
  try {
    const settings = await ShopSettings.getInstance();
    res.json(settings);
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// POST / PUT to update settings
router.post("/", upload.single("logo"), async (req, res) => {
  try {
    const settings = await ShopSettings.getInstance();

    // Update all text fields
    const updateData = {};
    Object.keys(req.body).forEach((key) => {
      if (key !== "logo" && req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    if (req.file) {
      updateData.logo = `/uploads/${req.file.filename}`;
    }

    await settings.update(updateData);
    res.json(settings);
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const settings = await ShopSettings.getInstance();
    await settings.update(req.body);
    res.json(settings);
  } catch (err) {
    console.error("Put settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;