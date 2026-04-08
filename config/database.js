const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

// Mock sequelize for production - MySQL nahi chalega
const mockModel = {
  findAll: async () => [],
  findOne: async () => null,
  findByPk: async () => null,
  create: async () => null,
  update: async () => null,
  destroy: async () => null,
  belongsTo: () => {},
  hasMany: () => {},
  hasOne: () => {},
  belongsToMany: () => {},
  sync: async () => {},
  prototype: {}, // ← yeh add karo
};

const mockSequelize = {
  define: () => mockModel,
  authenticate: async () => {},
  sync: async () => {},
  query: async () => [],
};

let sequelize;

if (isProduction) {
  console.log("ℹ️ Production mode — MySQL disabled, using MongoDB only");
  sequelize = mockSequelize;
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || "shop_management",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      define: {
        timestamps: true,
        underscored: false,
        freezeTableName: false,
        charset: "utf8",
        dialectOptions: { collate: "utf8_general_ci" },
      },
    },
  );
}

const testConnection = async () => {
  if (isProduction) return false;
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connected.");
    return true;
  } catch (error) {
    console.error("❌ MySQL failed:", error.message);
    return false;
  }
};

const syncDatabase = async (force = false) => {
  if (isProduction) return false;
  try {
    await sequelize.sync({ alter: !force, force });
    console.log("✅ Database synced");
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection, syncDatabase };
