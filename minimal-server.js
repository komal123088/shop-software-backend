const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");
const expenseRoutes = require("./routes/expense");
const { PORT } = require("./env");
const backupRoutes = require("./routes/backup");

console.log("🚀 Starting main server...");

// Connect DB with error handling
connectDB().catch(err => {
  console.error("❌ MongoDB connection failed:", err);
});

const app = express();

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin || "No origin");
  next();
});

// Create uploads directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Uploads directory created at:", uploadDir);
} else {
  console.log("✅ Uploads directory exists at:", uploadDir);
}

// CORS configuration - Allow all origins for testing
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Serve static files
app.use("/uploads", express.static(uploadDir));

// SIMPLE TEST ENDPOINTS - Add these FIRST
app.get("/api/ping", (req, res) => {
  console.log("✅ Ping endpoint hit!");
  res.json({ 
    message: "pong", 
    timestamp: new Date().toISOString(),
    server: "main",
    cors: "enabled"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoint to check uploads
app.get("/api/debug/uploads", (req, res) => {
  try {
    const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    res.json({
      exists: fs.existsSync(uploadDir),
      path: uploadDir,
      fileCount: files.length,
      files: files.slice(0, 10) // First 10 files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Your routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/sales", require("./routes/salesRoutes"));
app.use("/api/shop-settings", require("./routes/shopSettings"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/locations", require("./routes/locations"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/expenses", expenseRoutes);
app.use("/api/backup", backupRoutes);

const backupManagerRoutes = require('./routes/backupManager');
const backupScheduler = require('./services/backupScheduler');
app.use('/api/backup-manager', backupManagerRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Shop Management Backend Running");
});

// 404 handler
app.use((req, res) => {
  console.log("❌ 404 - Not found:", req.url);
  res.status(404).json({ 
    message: `Route ${req.url} not found`,
    available: ["/api/ping", "/api/health", "/api/backup/download"]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const MYPORT = PORT || 3000;


app.get("/api/test-large-file", (req, res) => {
  console.log("📦 Testing large file transfer");
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="test.bin"');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  
  // Create a 10MB test file
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalSize = 10 * 1024 * 1024; // 10MB
  let bytesSent = 0;
  
  const interval = setInterval(() => {
    if (bytesSent >= totalSize) {
      clearInterval(interval);
      res.end();
      return;
    }
    
    const chunk = Buffer.alloc(chunkSize, 'x');
    res.write(chunk);
    bytesSent += chunkSize;
    console.log(`Sent ${bytesSent / 1024 / 1024}MB`);
  }, 100);
});



// Listen on all interfaces
app.listen(MYPORT, '0.0.0.0', () => {
  console.log(`✅ Main server running on port ${MYPORT}`);
  console.log(`✅ Test endpoints:`);
  console.log(`   http://localhost:${MYPORT}/api/ping`);
  console.log(`   http://127.0.0.1:${MYPORT}/api/ping`);
  console.log(`   http://localhost:${MYPORT}/api/health`);
  console.log(`   http://localhost:${MYPORT}/api/debug/uploads`);

    backupScheduler.start();

});