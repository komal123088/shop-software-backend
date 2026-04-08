const Product = require("../models/Product");
const Sale = require("../models/Sale");

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const dailySales = await Sale.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    const monthlySales = await Sale.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    const todaysOrders = await Sale.countDocuments({
      createdAt: { $gte: today },
    });

    const lowStock = await Product.countDocuments({
      stock: { $lte: "$minStockAlert" },
    });

    const salesThisMonth = await Sale.find({
      createdAt: { $gte: monthStart },
    }).populate("items.product");
    let profit = 0;
    salesThisMonth.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.product) {
          profit += (item.price - item.product.costPrice) * item.qty;
        }
      });
    });

    res.json({
      dailySales: dailySales[0]?.total || 0,
      monthlySales: monthlySales[0]?.total || 0,
      totalProfit: profit,
      todaysOrders,
      lowStockCount: lowStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardStats };
