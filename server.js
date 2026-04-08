const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { sequelize, testConnection, syncDatabase } = require("./models");
require("dotenv").config();

// Import core routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/productRoutes");
const salesRoutes = require("./routes/salesRoutes");
const customerRoutes = require("./routes/customerRoutes");
const employeeRoutes = require("./routes/employees");
const expenseRoutes = require("./routes/expense");
const categoryRoutes = require("./routes/categories");
const inventoryRoutes = require("./routes/inventoryRoutes");
const locationRoutes = require("./routes/locations");
const notificationRoutes = require("./routes/notifications");
const shopSettingsRoutes = require("./routes/shopSettings");
const dashboardRoutes = require("./routes/dashboardRoutes");
// ============================================
// IMPORT BACKUP ROUTES - MOVE THESE UP HERE
// ============================================
const backupRoutes = require("./routes/backup");
const backupManagerRoutes = require("./routes/backupManager");

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get local IP address
function getLocalIP() {
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const LOCAL_IP = getLocalIP();
console.log(`🌐 Detected local IP: ${LOCAL_IP}`);

// Middleware
app.use(
  cors({
    origin: [
      "https://shop-software-frontend.vercel.app",
      "http://localhost:5173",
      `http://${LOCAL_IP}:5173`,
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse JSON and urlencoded data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files for uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Uploads directory created");
}
app.use("/uploads", express.static(uploadsDir));

// Request logging middleware (for development)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    // console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// ============================================
// CORE ROUTES
// ============================================

// Auth routes
app.use("/api/auth", authRoutes);
// console.log("✅ Auth routes loaded");

// Product routes
app.use("/api/products", productRoutes);
// console.log("✅ Product routes loaded");

// Sales routes
app.use("/api/sales", salesRoutes);
// console.log("✅ Sales routes loaded");

// Customer routes
app.use("/api/customers", customerRoutes);
// console.log("✅ Customer routes loaded");

// Employee routes
app.use("/api/employees", employeeRoutes);
// console.log("✅ Employee routes loaded");

// Expense routes
app.use("/api/expenses", expenseRoutes);
// console.log("✅ Expense routes loaded");

// Category routes
app.use("/api/categories", categoryRoutes);
// console.log("✅ Category routes loaded");

// Inventory routes
app.use("/api/inventory", inventoryRoutes);
// console.log("✅ Inventory routes loaded");

// Location routes
app.use("/api/locations", locationRoutes);
// console.log("✅ Location routes loaded");

// Notification routes
app.use("/api/notifications", notificationRoutes);
// console.log("✅ Notification routes loaded");

// Shop settings routes
app.use("/api/shop-settings", shopSettingsRoutes);
// console.log("✅ Shop settings routes loaded");

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);
// console.log("✅ Dashboard routes loaded");
app.use("/api/return-exchange", require("./routes/returnExchange"));

// ============================================
// BACKUP ROUTES - REGISTER HERE BEFORE SERVER STARTS
// ============================================
app.use("/api/backup", backupRoutes);
// console.log("✅ Backup routes loaded");

app.use("/api/backup-manager", backupManagerRoutes);
// console.log("✅ Backup manager routes loaded");

// ============================================
// TEST AND HEALTH ROUTES
// ============================================

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is running",
    time: new Date().toISOString(),
    serverIp: LOCAL_IP,
    routes: [
      "/api/auth",
      "/api/products",
      "/api/sales",
      "/api/customers",
      "/api/employees",
      "/api/expenses",
      "/api/categories",
      "/api/inventory",
      "/api/locations",
      "/api/notifications",
      "/api/shop-settings",
      "/api/dashboard",
      "/api/backup",
      "/api/backup-manager",
      "/api/test",
      "/api/health",
    ],
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    database: process.env.DB_NAME,
    environment: process.env.NODE_ENV || "development",
    serverIp: LOCAL_IP,
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Shop Management System API",
    version: "1.0.0",
    serverIp: LOCAL_IP,
    documentation: "Use /api/health for status, /api/test for route list",
  });
});

// ============================================
// 404 HANDLER - Must be after all routes
// ============================================
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    availableRoutes: "/api/test",
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  // console.error("❌ Server error:", err);

  // Handle specific error types
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: err.errors.map((e) => e.message),
    });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(400).json({
      message: "Duplicate entry",
      errors: err.errors.map((e) => e.message),
    });
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      message: "Referenced record does not exist",
    });
  }

  if (err.name === "SequelizeDatabaseError") {
    return res.status(400).json({
      message: "Database error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Max size: 5MB" });
  }

  // Default error response
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
  try {
    console.log("🔄 Starting server...");
    console.log("🔄 Testing database connection...");

    await testConnection();
    console.log("✅ Database connection successful");

    console.log("🔄 Syncing database...");
    await syncDatabase(false);
    console.log("✅ Database sync completed");

    app.listen(PORT, "0.0.0.0", () => {
      console.log("\n=================================");
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📊 Database: ${process.env.DB_NAME}`);
      console.log(`📁 Uploads directory: ${uploadsDir}`);
      console.log("=================================\n");
      console.log(`🔗 Local URL: http://localhost:${PORT}/api/test`);
      console.log(`📡 Network URL: http://${LOCAL_IP}:${PORT}/api/test`);
      console.log(`📱 Access from other devices: http://${LOCAL_IP}:${PORT}`);
      console.log("\n📋 Available routes:");
      console.log("   - /api/auth/*");
      console.log("   - /api/products/*");
      console.log("   - /api/sales/*");
      console.log("   - /api/customers/*");
      console.log("   - /api/employees/*");
      console.log("   - /api/expenses/*");
      console.log("   - /api/categories/*");
      console.log("   - /api/inventory/*");
      console.log("   - /api/locations/*");
      console.log("   - /api/notifications/*");
      console.log("   - /api/shop-settings/*");
      console.log("   - /api/dashboard/*");
      console.log("   - /api/backup/*");
      console.log("   - /api/backup-manager/*");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);

    if (
      error.name === "SequelizeConnectionError" ||
      error.name === "SequelizeConnectionRefusedError"
    ) {
      console.error("\n📌 Database connection failed. Please check:");
      console.error("   - MySQL server is running");
      console.error("   - Database credentials in .env file");
      console.error("   - Database name exists");
      console.error("   - MySQL port (default: 3306) is correct");
      console.error("   - Network connectivity\n");

      console.error("📋 Your current .env settings:");
      console.error(`   DB_HOST: ${process.env.DB_HOST || "localhost"}`);
      console.error(`   DB_PORT: ${process.env.DB_PORT || 3306}`);
      console.error(`   DB_NAME: ${process.env.DB_NAME || "shop_management"}`);
      console.error(`   DB_USER: ${process.env.DB_USER || "root"}`);
      console.error(
        `   DB_PASSWORD: ${process.env.DB_PASSWORD ? "********" : "(empty)"}`,
      );
    }

    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Closing server...");
  sequelize.close().then(() => {
    console.log("✅ Database connection closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Closing server...");
  sequelize.close().then(() => {
    console.log("✅ Database connection closed");
    process.exit(0);
  });
});

// Start the server
startServer();
