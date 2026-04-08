const express = require("express");
const router = express.Router();
const { Expense } = require("../models");
const { Op } = require("sequelize");

// GET all expenses with date filter
router.get("/", async (req, res) => {
  try {
    const { start, end, type } = req.query;

    let whereClause = {};

    // Date filter
    if (start || end) {
      whereClause.date = {};
      if (start) whereClause.date[Op.gte] = new Date(start);
      if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        whereClause.date[Op.lte] = endDate;
      }
    }

    // Type filter
    if (type) {
      whereClause.type = type;
    }

    const expenses = await Expense.findAll({
      where: whereClause,
      order: [['date', 'DESC']]
    });
    
    res.json(expenses);
  } catch (err) {
    console.error("GET expenses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST - Add new expense
router.post("/", async (req, res) => {
  try {
    const expense = await Expense.create({
      type: req.body.type,
      category: req.body.category,
      description: req.body.description,
      amount: Number(req.body.amount),
      employeeId: req.body.employee || null,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      paymentMethod: req.body.paymentMethod || "cash",
      notes: req.body.notes || "",
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error("POST expense error:", err);
    res.status(400).json({ message: err.message });
  }
});

// PUT - Update expense
router.put("/:id", async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await expense.update({
      type: req.body.type || expense.type,
      category: req.body.category || expense.category,
      description: req.body.description || expense.description,
      amount: req.body.amount !== undefined ? Number(req.body.amount) : expense.amount,
      employeeId: req.body.employee || expense.employeeId,
      date: req.body.date ? new Date(req.body.date) : expense.date,
      paymentMethod: req.body.paymentMethod || expense.paymentMethod,
      notes: req.body.notes || expense.notes,
    });

    res.json(expense);
  } catch (err) {
    console.error("PUT expense error:", err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE expense
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await expense.destroy();
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("DELETE expense error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET expense summary
router.get("/summary", async (req, res) => {
  try {
    const { start, end } = req.query;

    let whereClause = {};
    if (start || end) {
      whereClause.date = {};
      if (start) whereClause.date[Op.gte] = new Date(start);
      if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        whereClause.date[Op.lte] = endDate;
      }
    }

    // Total expenses by type
    const expensesByType = await Expense.findAll({
      where: whereClause,
      attributes: [
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    // Total expenses
    const totalExpensesResult = await Expense.sum('amount', {
      where: whereClause
    });

    res.json({
      expensesByType,
      totalExpenses: totalExpensesResult || 0,
    });
  } catch (err) {
    console.error("Expense summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;