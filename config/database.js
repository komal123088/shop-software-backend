const { Sequelize } = require("sequelize");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

let sequelize;

if (isProduction && process.env.MYSQL_URL) {
  sequelize = new Sequelize(process.env.MYSQL_URL, {
    dialect: "mysql",
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });
} else if (!isProduction) {
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
    },
  );
} else {
  // Fallback mock
  sequelize = {
    define: () => ({ prototype: {} }),
    authenticate: async () => {},
    sync: async () => {},
  };
}

const testConnection = async () => {
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
  try {
    await sequelize.sync({ alter: !force, force });
    console.log("✅ Database synced");
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection, syncDatabase };
