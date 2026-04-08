const express = require("express");
const router = express.Router();
const { Inventory } = require("../models");
const { sequelize } = require("../config/database");

// GET all inventory purchases
router.get("/", async (req, res) => {
  try {
    const inventory = await Inventory.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(inventory);
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET stats summary
router.get("/stats", async (req, res) => {
  try {
    const all = await Inventory.findAll();

    const totalPurchased = all.reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const totalPaid = all.reduce((sum, i) => sum + Number(i.amountPaid), 0);
    const totalRemaining = all.reduce((sum, i) => sum + Number(i.remainingAmount), 0);
    const totalItems = all.length;
    const totalQuantity = all.reduce((sum, i) => sum + i.quantity, 0);

    // Per supplier summary
    const supplierMap = {};
    all.forEach((item) => {
      if (!supplierMap[item.supplierName]) {
        supplierMap[item.supplierName] = {
          supplierName: item.supplierName,
          supplierPhone: item.supplierPhone,
          totalPurchased: 0,
          totalPaid: 0,
          totalRemaining: 0,
          totalItems: 0,
        };
      }
      supplierMap[item.supplierName].totalPurchased += Number(item.totalAmount);
      supplierMap[item.supplierName].totalPaid += Number(item.amountPaid);
      supplierMap[item.supplierName].totalRemaining += Number(item.remainingAmount);
      supplierMap[item.supplierName].totalItems += 1;
    });

    res.json({
      totalPurchased,
      totalPaid,
      totalRemaining,
      totalItems,
      totalQuantity,
      suppliers: Object.values(supplierMap),
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST add new inventory purchase
router.post("/", async (req, res) => {
  try {
    const {
      supplierName,
      supplierPhone,
      itemDescription,
      quantity,
      unit,
      purchasePrice,
      amountPaid,
      purchaseDate,
      notes,
    } = req.body;

    if (!supplierName || !itemDescription || !quantity || !purchasePrice) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const totalAmount = Number(quantity) * Number(purchasePrice);
    const paid = Number(amountPaid) || 0;

    if (paid > totalAmount) {
      return res.status(400).json({ message: "Paid amount cannot exceed total amount" });
    }

    const entry = await Inventory.create({
      supplierName,
      supplierPhone,
      itemDescription,
      quantity: Number(quantity),
      unit: unit || "Piece",
      purchasePrice: Number(purchasePrice),
      totalAmount,
      amountPaid: paid,
      remainingAmount: totalAmount - paid,
      purchaseDate: purchaseDate || new Date(),
      notes,
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error("Create inventory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PATCH record payment against an entry
router.patch("/:id/payment", async (req, res) => {
  try {
    const { amount } = req.body;
    const entry = await Inventory.findByPk(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const newPaid = Number(entry.amountPaid) + Number(amount);
    if (newPaid > Number(entry.totalAmount)) {
      return res.status(400).json({ message: "Payment exceeds total amount" });
    }

    await entry.update({
      amountPaid: newPaid,
      remainingAmount: Number(entry.totalAmount) - newPaid
    });

    res.json(entry);
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE an entry
router.delete("/:id", async (req, res) => {
  try {
    const entry = await Inventory.findByPk(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }
    
    await entry.destroy();
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;