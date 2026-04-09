const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
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

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connected.");
    return true;
  } catch (error) {
    console.error("❌ MySQL failed:", error.message);
    throw error;
  }
};

const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ alter: !force, force });
    console.log("✅ Database synced");
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    throw error;
  }
};

module.exports = { sequelize, testConnection, syncDatabase };
