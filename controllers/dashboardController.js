const { Op, fn, col, literal } = require("sequelize");
const { Sale, SaleItem, Product, Customer, Employee } = require("../models");

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      dailySalesResult,
      monthlySalesResult,
      todaysOrders,
      totalSalesCount,
      lowStockCount,
      totalProducts,
      totalCustomers,
      totalEmployees,
      weeklyTrend,
      topProducts,
      recentSales,
    ] = await Promise.all([
      Sale.findOne({
        attributes: [
          [fn("COALESCE", fn("SUM", col("total")), 0), "totalSales"],
          [fn("COUNT", col("id")), "saleCount"],
        ],
        where: { createdAt: { [Op.between]: [todayStart, todayEnd] } },
        raw: true,
      }),

      Sale.findOne({
        attributes: [
          [fn("COALESCE", fn("SUM", col("total")), 0), "totalSales"],
        ],
        where: { createdAt: { [Op.between]: [monthStart, monthEnd] } },
        raw: true,
      }),

      Sale.count({
        where: { createdAt: { [Op.between]: [todayStart, todayEnd] } },
      }),

      Sale.count(),

      Product.count({ where: { stock: { [Op.lte]: 5 } } }),

      Product.count(),

      Customer.count(),

      Employee.count(),

      Sale.findAll({
        attributes: [
          [fn("DATE", col("createdAt")), "date"],
          [fn("COALESCE", fn("SUM", col("total")), 0), "total"],
        ],
        where: { createdAt: { [Op.between]: [sevenDaysAgo, todayEnd] } },
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
      }),

      SaleItem.findAll({
        attributes: [
          "productId",
          [fn("SUM", col("SaleItem.qty")), "totalQty"],
          [
            literal("SUM(`SaleItem`.`qty` * `SaleItem`.`price`)"),
            "totalRevenue",
          ],
        ],
        include: [
          {
            model: Sale,
            attributes: [],
            required: true,
            where: { createdAt: { [Op.between]: [monthStart, monthEnd] } },
          },
          {
            model: Product,
            attributes: ["name"],
            required: true,
          },
        ],
        group: ["SaleItem.productId", "Product.id", "Product.name"],
        order: [
          [literal("SUM(`SaleItem`.`qty` * `SaleItem`.`price`)"), "DESC"],
        ],
        limit: 5,
        subQuery: false,
        raw: true,
        nest: true,
      }),

      Sale.findAll({
        attributes: ["id", "total", "createdAt"],
        include: [
          {
            model: Customer,
            attributes: ["name"],
            required: false,
            as: "customer",
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
    ]);

    // Build 7-day trend
    const trendMap = {};
    weeklyTrend.forEach((row) => {
      trendMap[row.date] = parseFloat(row.total) || 0;
    });

    const dailyData = [],
      dailyLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyData.push(trendMap[key] || 0);
      dailyLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    }

    res.json({
      dailySales: parseFloat(dailySalesResult?.totalSales) || 0,
      monthlySales: parseFloat(monthlySalesResult?.totalSales) || 0,
      totalProfit: 0,
      todaysOrders: parseInt(dailySalesResult?.saleCount) || 0,
      totalSalesCount,
      lowStockCount,
      totalProducts,
      totalCustomers,
      totalEmployees,
      salesTrend: { labels: dailyLabels, data: dailyData },
      topProducts: topProducts.map((item) => ({
        name: item.Product?.name || "Unknown",
        revenue: parseFloat(item.totalRevenue) || 0,
        qty: parseInt(item.totalQty) || 0,
      })),
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        message: `Sale #${sale.id} — RS ${parseFloat(sale.total).toLocaleString()}`,
        customer: sale.customer?.name || "Walk-in",
        createdAt: sale.createdAt,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to load dashboard", error: error.message });
  }
};

module.exports = { getDashboardStats };
