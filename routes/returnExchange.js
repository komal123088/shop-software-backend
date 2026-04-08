const express = require("express");
const router = express.Router();
const {
  Sale,
  SaleItem,
  Product,
  Customer,
  Payment,
  ReturnExchange,
} = require("../models");
const { sequelize } = require("../config/database");
const { Op } = require("sequelize");

// ============================================
// GET ALL RETURNS
// ============================================
router.get("/", async (req, res) => {
  try {
    const returns = await ReturnExchange.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Sale,
          as: "originalSale",
          attributes: ["id", "saleNumber", "saleType", "total"],
        },
      ],
    });
    res.json(returns);
  } catch (err) {
    console.error("❌ GET returns error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// GET SALE INFO FOR RETURN (lookup by sale number)
// ============================================
router.get("/sale/:saleNumber", async (req, res) => {
  try {
    const sale = await Sale.findOne({
      where: {
        [Op.or]: [
          { saleNumber: req.params.saleNumber },
          { id: isNaN(req.params.saleNumber) ? 0 : req.params.saleNumber },
        ],
      },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              attributes: [
                "id",
                "name",
                "stock",
                "costPrice",
                "salePrice",
                "image",
              ],
            },
          ],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "phone"],
        },
      ],
    });

    if (!sale) {
      return res
        .status(404)
        .json({ message: "Sale not found. Check sale number." });
    }

    // Check existing returns for this sale
    const existingReturns = await ReturnExchange.findAll({
      where: {
        originalSaleId: sale.id,
        status: { [Op.ne]: "cancelled" },
      },
    });

    res.json({ sale, existingReturns });
  } catch (err) {
    console.error("❌ Sale lookup error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// PROCESS RETURN
// ============================================
router.post("/", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      originalSaleId,
      reason,
      items, // [{ productId, name, qty, price, condition }]
      refundMethod, // "cash" | "store_credit" | "original_method"
      notes,
    } = req.body;

    if (!originalSaleId) throw new Error("Original sale ID required");
    if (!items || items.length === 0)
      throw new Error("No items selected for return");
    if (!reason) throw new Error("Return reason required");

    const originalSale = await Sale.findByPk(originalSaleId, {
      include: [{ model: SaleItem, as: "items" }],
      transaction,
    });

    if (!originalSale) throw new Error("Original sale not found");

    // Calculate return amount
    const returnAmount = items.reduce((sum, item) => {
      const saleItem = originalSale.items.find(
        (si) => si.productId == item.productId,
      );
      const price = saleItem ? Number(saleItem.price) : Number(item.price) || 0;
      return sum + price * item.qty;
    }, 0);

    // Generate return number
    const date = new Date();
    const retNumber = `RET-${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}-${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, "0")}`;

    // Create Return record
    const returnRecord = await ReturnExchange.create(
      {
        returnNumber: retNumber,
        originalSaleId,
        type: "return",
        reason: reason || "",
        notes: notes || "",
        items: JSON.stringify(items),
        exchangeItems: null,
        returnAmount,
        exchangeAmount: 0,
        balanceDue: -returnAmount, // negative = refund to customer
        refundMethod: refundMethod || "cash",
        status: "completed",
      },
      { transaction },
    );

    // ✅ Restore stock for returned items (skip damaged items)
    for (const item of items) {
      if (item.condition !== "damaged") {
        await Product.update(
          { stock: sequelize.literal(`stock + ${item.qty}`) },
          { where: { id: item.productId }, transaction },
        );
      }
    }

    // ✅ Handle store credit for permanent customers
    if (originalSale.saleType === "permanent" && originalSale.customerId) {
      if (refundMethod === "store_credit") {
        await Customer.update(
          { remainingDue: sequelize.literal(`remainingDue - ${returnAmount}`) },
          { where: { id: originalSale.customerId }, transaction },
        );
      }
    }

    await transaction.commit();

    const complete = await ReturnExchange.findByPk(returnRecord.id, {
      include: [
        { model: Sale, as: "originalSale", attributes: ["id", "saleNumber"] },
      ],
    });

    res.status(201).json(complete);
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Return error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ============================================
// CANCEL RETURN
// ============================================
router.patch("/:id/cancel", async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const ret = await ReturnExchange.findByPk(req.params.id, { transaction });
    if (!ret) {
      await transaction.rollback();
      return res.status(404).json({ message: "Return not found" });
    }

    if (ret.status === "cancelled") {
      await transaction.rollback();
      return res.status(400).json({ message: "Already cancelled" });
    }

    // Reverse stock — deduct back what was restored
    const items = JSON.parse(ret.items || "[]");
    for (const item of items) {
      if (item.condition !== "damaged") {
        await Product.update(
          { stock: sequelize.literal(`stock - ${item.qty}`) },
          { where: { id: item.productId }, transaction },
        );
      }
    }

    await ret.update({ status: "cancelled" }, { transaction });
    await transaction.commit();
    res.json({ message: "Return cancelled successfully" });
  } catch (err) {
    await transaction.rollback();
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
