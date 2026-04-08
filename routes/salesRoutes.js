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

// ✅ Helper: parse customerInfo if it came back as string
const parseSale = (sale) => {
  const s = sale.toJSON ? sale.toJSON() : { ...sale };
  if (s.customerInfo && typeof s.customerInfo === "string") {
    try {
      s.customerInfo = JSON.parse(s.customerInfo);
    } catch {
      s.customerInfo = null;
    }
  }
  return s;
};

// ============================================
// REPORT ROUTE - FIXED (Returns deducted)
// ============================================
router.get("/report", async (req, res) => {
  try {
    const { start, end } = req.query;

    let startDate, endDate;
    if (start && end) {
      startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    }

    // ✅ Recovered credit = ONLY payments for permanent/temporary sales
    let recoveredAmount = 0;
    if (startDate && endDate) {
      const creditSaleIds = await Sale.findAll({
        where: { saleType: { [Op.in]: ["permanent", "temporary"] } },
        attributes: ["id"],
        raw: true,
      });

      if (creditSaleIds.length > 0) {
        const ids = creditSaleIds.map((s) => s.id);
        const recoveredResult = await Payment.sum("amount", {
          where: {
            saleId: { [Op.in]: ids },
            date: { [Op.gte]: startDate, [Op.lte]: endDate },
          },
        });
        recoveredAmount = recoveredResult || 0;
      }
    }

    const salesQuery = {};
    if (startDate && endDate) {
      salesQuery.createdAt = { [Op.gte]: startDate, [Op.lte]: endDate };
    }

    const sales = await Sale.findAll({
      where: salesQuery,
      include: [{ model: SaleItem, as: "items" }],
    });

    const returnsQuery = { status: "completed" };
    if (startDate && endDate) {
      returnsQuery.createdAt = { [Op.gte]: startDate, [Op.lte]: endDate };
    }

    const returns = await ReturnExchange.findAll({ where: returnsQuery });

    const totalReturnAmount = returns.reduce(
      (sum, r) => sum + (Number(r.returnAmount) || 0),
      0,
    );

    const grossSales = sales.reduce(
      (sum, s) => sum + (Number(s.total) || 0),
      0,
    );
    const totalSales = Math.max(0, grossSales - totalReturnAmount);

    const grossCashSales = sales
      .filter((s) => s.saleType === "cash")
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const cashSales = Math.max(0, grossCashSales - totalReturnAmount);
    const creditSales = Math.max(0, totalSales - cashSales);

    let actualProfit = 0;
    const productMap = {};

    for (const sale of sales) {
      const items = await SaleItem.findAll({
        where: { saleId: sale.id },
        include: [{ model: Product, attributes: ["id", "costPrice"] }],
      });

      items.forEach((item) => {
        const name = item.name || "Unknown";
        if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 };
        productMap[name].qty += item.qty || 0;

        const itemRevenue = (Number(item.price) || 0) * (item.qty || 0);
        productMap[name].revenue += itemRevenue;

        const costPrice = item.Product
          ? Number(item.Product.costPrice) || 0
          : 0;
        actualProfit += (Number(item.price) - costPrice) * (item.qty || 0);
      });
    }

    for (const r of returns) {
      const retItems = JSON.parse(r.items || "[]");
      for (const item of retItems) {
        const prod = await Product.findByPk(item.productId, {
          attributes: ["costPrice"],
        });
        const costPrice = prod ? Number(prod.costPrice) || 0 : 0;
        const profitLost = (Number(item.price) - costPrice) * (item.qty || 0);
        actualProfit -= profitLost;
      }
    }
    actualProfit = Math.max(0, actualProfit);

    const totalDiscount = sales.reduce((sum, s) => {
      const subtotal = Number(s.subtotal) || 0;
      const discountPct = Number(s.discountPercent) || 0;
      return sum + (subtotal * discountPct) / 100;
    }, 0);
    actualProfit = Math.max(0, actualProfit - totalDiscount);

    // ✅ Service charge aur tax = pure revenue (no cost) — profit mein add karo
    const totalServiceCharge = sales.reduce(
      (sum, s) => sum + (Number(s.serviceCharge) || 0),
      0,
    );
    const totalTax = sales.reduce((sum, s) => sum + (Number(s.tax) || 0), 0);
    actualProfit = actualProfit + totalServiceCharge + totalTax;

    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const customers = await Customer.findAll();
    const permanentRemaining = customers.reduce(
      (sum, c) => sum + (Number(c.remainingDue) || 0),
      0,
    );

    const allTempSales = await Sale.findAll({
      where: { saleType: "temporary" },
    });
    const temporaryRemaining = allTempSales.reduce(
      (sum, s) => sum + ((Number(s.total) || 0) - (Number(s.paidAmount) || 0)),
      0,
    );

    res.json({
      totalSales,
      cashSales,
      creditSales,
      recoveredAmount,
      profit: actualProfit,
      saleCount: sales.length,
      returnCount: returns.length,
      totalReturnAmount,
      cashCount: sales.filter((s) => s.saleType === "cash").length,
      creditCount: sales.filter((s) => s.saleType !== "cash").length,
      topProducts,
      permanentRemaining,
      temporaryRemaining,
    });
  } catch (err) {
    console.error("❌ Report error:", err);
    res.status(500).json({ message: "Report error: " + err.message });
  }
});

// ============================================
// CREATE SALE
// ============================================
router.post("/", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const saleData = req.body;

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const saleNumber = `SALE-${year}${month}${day}-${random}`;

    const sale = await Sale.create(
      {
        saleNumber,
        customerId: saleData.customer || null,
        customerInfo: saleData.customerInfo || null,
        saleType: saleData.saleType || "cash",
        total: saleData.total || 0,
        paidAmount: saleData.paidAmount || 0,
        subtotal: saleData.subtotal || 0,
        discountPercent: saleData.discountPercent || 0,
        serviceCharge: saleData.serviceCharge || 0,
        tax: saleData.tax || 0,
        createdBy: saleData.createdBy || null,
      },
      { transaction },
    );

    if (saleData.items && saleData.items.length > 0) {
      for (const item of saleData.items) {
        if (!item.product)
          throw new Error(`Product ID missing for: ${item.name}`);

        await SaleItem.create(
          {
            saleId: sale.id,
            productId: item.product,
            name: item.name || "Unknown",
            qty: item.qty || 0,
            price: item.price || 0,
          },
          { transaction },
        );

        await Product.update(
          { stock: sequelize.literal(`stock - ${item.qty || 0}`) },
          { where: { id: item.product }, transaction },
        );
      }
    }

    if (saleData.saleType === "cash" && saleData.payments?.length > 0) {
      for (const payment of saleData.payments) {
        if (payment.amount && Number(payment.amount) > 0) {
          await Payment.create(
            {
              saleId: sale.id,
              method: payment.method || "cash",
              amount: payment.amount,
              detail: payment.detail || "",
              date: new Date(),
            },
            { transaction },
          );
        }
      }
    }

    if (saleData.saleType === "permanent" && saleData.customer) {
      await Customer.update(
        {
          totalPurchases: sequelize.literal(
            `totalPurchases + ${saleData.total || 0}`,
          ),
          remainingDue: sequelize.literal(
            `remainingDue + ${saleData.total || 0}`,
          ),
        },
        { where: { id: saleData.customer }, transaction },
      );
    }

    await transaction.commit();

    const completeSale = await Sale.findByPk(sale.id, {
      include: [
        { model: SaleItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Payment, as: "payments" },
      ],
    });

    // ✅ Parse customerInfo before sending response
    res.status(201).json(parseSale(completeSale));
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Sale error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ============================================
// GET ALL SALES — ✅ customerInfo parsed
// ============================================
router.get("/", async (req, res) => {
  try {
    const sales = await Sale.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        { model: SaleItem, as: "items" },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "phone"],
        },
        { model: Payment, as: "payments" },
      ],
    });
    // ✅ Parse customerInfo for every sale
    res.json(sales.map(parseSale));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// GET SINGLE SALE — ✅ customerInfo parsed
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        { model: SaleItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Payment, as: "payments" },
      ],
    });
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    // ✅ Parse customerInfo
    res.json(parseSale(sale));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// UPDATE SALE
// ============================================
router.patch("/:id", async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    await sale.update(req.body);
    const updated = await Sale.findByPk(req.params.id, {
      include: [
        { model: SaleItem, as: "items" },
        { model: Payment, as: "payments" },
      ],
    });
    res.json(parseSale(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ============================================
// ADD PAYMENT TO SALE
// ============================================
router.post("/:id/payments", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { amount, method, detail } = req.body;
    const saleId = req.params.id;

    const sale = await Sale.findByPk(saleId, { transaction });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    const payment = await Payment.create(
      {
        saleId,
        amount,
        method: method || "cash",
        detail: detail || "",
        date: new Date(),
      },
      { transaction },
    );

    const newPaidAmount = (Number(sale.paidAmount) || 0) + Number(amount);
    await sale.update({ paidAmount: newPaidAmount }, { transaction });

    if (sale.saleType === "permanent" && sale.customerId) {
      await Customer.update(
        {
          totalPaid: sequelize.literal(`totalPaid + ${amount}`),
          remainingDue: sequelize.literal(`remainingDue - ${amount}`),
        },
        { where: { id: sale.customerId }, transaction },
      );
    }

    await transaction.commit();
    res.status(201).json(payment);
  } catch (err) {
    await transaction.rollback();
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
