const express = require("express");
const router = express.Router();
const { Customer, Sale, Payment } = require("../models");
const { sequelize } = require("../config/database");
const { Op } = require("sequelize");

// GET all permanent customers with totalCredit calculated
router.get("/permanent", async (req, res) => {
  try {
    const customers = await Customer.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    // Calculate totalCredit for each customer from their sales
    const customersWithCredit = await Promise.all(
      customers.map(async (customer) => {
        // Get all sales for this customer
        const sales = await Sale.findAll({
          where: {
            customerId: customer.id,
            saleType: "permanent",
          },
          attributes: [
            [sequelize.fn('SUM', sequelize.col('total')), 'totalCredit']
          ],
          raw: true
        });

        const totalCredit = Number(sales[0]?.totalCredit) || 0;

        // Return customer with totalCredit field
        return {
          ...customer.toJSON(),
          totalCredit: totalCredit,
        };
      }),
    );

    res.json(customersWithCredit);
  } catch (err) {
    console.error("GET permanent error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST - Add new permanent customer
router.post("/permanent", async (req, res) => {
  try {
    const customer = await Customer.create({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email || null,
      gender: req.body.gender || "male",
      address: req.body.address || null,
      cnic: req.body.cnic || null,
      creditLimit: Number(req.body.creditLimit) || 50000,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      totalPurchases: 0,
      totalPaid: 0,
      remainingDue: 0,
      isActive: true
    });

    // Add totalCredit field (0 for new customer)
    const customerWithCredit = {
      ...customer.toJSON(),
      totalCredit: 0,
    };

    res.status(201).json(customerWithCredit);
  } catch (err) {
    console.error("POST customer error:", err);
    res.status(400).json({ message: err.message });
  }
});

// Record payment
router.post("/:id/payment", async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { amount, method = "cash", detail = "", saleId } = req.body;
    const customerId = req.params.id;

    if (!saleId) {
      await transaction.rollback();
      return res.status(400).json({ message: "saleId is required for payment" });
    }

    const customer = await Customer.findByPk(customerId, { transaction });
    if (!customer) {
      await transaction.rollback();
      return res.status(404).json({ message: "Customer not found" });
    }

    const sale = await Sale.findByPk(saleId, { transaction });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }
    
    if (sale.customerId !== parseInt(customerId)) {
      await transaction.rollback();
      return res.status(403).json({ message: "Sale does not belong to this customer" });
    }

    const paymentAmount = Number(amount);
    if (paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Create payment record
    await Payment.create({
      saleId: sale.id,
      customerId: customer.id,
      amount: paymentAmount,
      method,
      detail,
      date: new Date()
    }, { transaction });

    // Update sale paid amount
    const newPaidAmount = (Number(sale.paidAmount) || 0) + paymentAmount;
    await sale.update({ paidAmount: newPaidAmount }, { transaction });

    // Update customer
    const newTotalPaid = (Number(customer.totalPaid) || 0) + paymentAmount;
    const newRemainingDue = Math.max(0, (Number(customer.remainingDue) || 0) - paymentAmount);
    
    await customer.update({
      totalPaid: newTotalPaid,
      remainingDue: newRemainingDue
    }, { transaction });

    await transaction.commit();

    // Calculate totalCredit from all sales
    const salesTotal = await Sale.sum('total', {
      where: {
        customerId: customer.id,
        saleType: "permanent"
      }
    });

    const totalCredit = Number(salesTotal) || 0;

    // Get updated customer
    const updatedCustomer = await Customer.findByPk(customer.id);

    // Add totalCredit to response
    const customerWithCredit = {
      ...updatedCustomer.toJSON(),
      totalCredit: totalCredit,
    };

    // Get updated sale with payments
    const updatedSale = await Sale.findByPk(sale.id, {
      include: [{ model: Payment, as: 'payments' }]
    });

    res.json({
      message: "Payment recorded successfully",
      customer: customerWithCredit,
      sale: updatedSale,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Payment error:", err);
    res.status(400).json({ message: err.message });
  }
});

// GET customer credit sales history with date filter
router.get("/:id/sales", async (req, res) => {
  try {
    const { from, to } = req.query;
    const customerId = req.params.id;

    const whereClause = {
      customerId: customerId,
      saleType: "permanent",
    };

    if (from || to) {
      whereClause.createdAt = {};
      if (from) whereClause.createdAt[Op.gte] = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = end;
      }
    }

    const sales = await Sale.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    res.json(sales);
  } catch (err) {
    console.error("GET customer sales error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

module.exports = router;