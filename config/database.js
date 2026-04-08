const { Sequelize } = require("sequelize");
require("dotenv").config();

// Hamesha instance banao taake models crash na karein
// Production mein connect nahi karega
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
  if (process.env.NODE_ENV === "production") {
    console.log("ℹ️ Production — MySQL connection skipped");
    return false;
  }
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connected successfully.");
    return true;
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
    return false;
  }
};

const syncDatabase = async (force = false) => {
  if (process.env.NODE_ENV === "production") {
    console.log("ℹ️ Production — MySQL sync skipped");
    return false;
  }
  try {
    await sequelize.sync({ alter: !force, force });
    console.log("✅ Database synced successfully");
  } catch (error) {
    console.error("❌ Database sync failed:", error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection, syncDatabase };
