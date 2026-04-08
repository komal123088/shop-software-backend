const { sequelize } = require("../config/database");
const Category = require("./Category");
const Customer = require("./Customer");
const Employee = require("./Employee");
const Expense = require("./Expense");
const Inventory = require("./Inventory");
const Location = require("./Location");
const Notification = require("./Notification");
const Owner = require("./Owner");
const Product = require("./Product");
const Sale = require("./Sale");
const SaleItem = require("./SaleItem");
const Payment = require("./Payment");
const ShopSettings = require("./ShopSettings");
const ReturnExchange = require("./ReturnExchange");
// associations mein:
// Define relationships
// Sale - SaleItem (one-to-many)
Sale.hasMany(SaleItem, { foreignKey: "saleId", as: "items" });
SaleItem.belongsTo(Sale, { foreignKey: "saleId" });

// Sale - Customer (many-to-one)
Sale.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Customer.hasMany(Sale, { foreignKey: "customerId" });

Sale.hasMany(ReturnExchange, { foreignKey: "originalSaleId", as: "returns" });
ReturnExchange.belongsTo(Sale, {
  foreignKey: "originalSaleId",
  as: "originalSale",
});
// Sale - Product through SaleItem
Product.hasMany(SaleItem, { foreignKey: "productId" });
SaleItem.belongsTo(Product, { foreignKey: "productId" });

// Payment relationships
Sale.hasMany(Payment, { foreignKey: "saleId", as: "payments" });
Payment.belongsTo(Sale, { foreignKey: "saleId" });

// Location - Employee relationship
Location.belongsTo(Employee, { foreignKey: "assignedStaff", as: "staff" });
Employee.hasOne(Location, { foreignKey: "assignedStaff" });

// Sync all models
const syncDatabase = async (options = {}) => {
  try {
    // If options is false or empty, just sync without altering
    if (options === false || Object.keys(options).length === 0) {
      await sequelize.sync();
    } else {
      await sequelize.sync(options);
    }
    console.log("✅ Database synced successfully");
  } catch (error) {
    console.error("❌ Database sync failed:", error);
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connection established successfully.");
    return true;
  } catch (error) {
    console.error("❌ Unable to connect to MySQL:", error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Category,
  Customer,
  Employee,
  Expense,
  Inventory,
  Location,
  Notification,
  Owner,
  Product,
  Sale,
  SaleItem,
  Payment,
  ShopSettings,
  ReturnExchange,
  syncDatabase,
  testConnection,
};
