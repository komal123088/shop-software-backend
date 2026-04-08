const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { Product } = require("../models");
const { Op } = require("sequelize");

// Use memoryStorage for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
});

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST create product
router.post("/", upload.single("image"), async (req, res) => {
  try {
    console.log("Creating product...");
    
    // Parse the request body
    const productData = {};
    
    // Copy all fields from req.body
    for (let key in req.body) {
      productData[key] = req.body[key];
    }

    // Convert string values to numbers
    productData.stock = Number(productData.stock) || 0;
    productData.costPrice = Number(productData.costPrice) || 0;
    productData.salePrice = Number(productData.salePrice) || 0;
    productData.minStockAlert = Number(productData.minStockAlert) || 10;

    // Handle empty strings for optional fields
    if (!productData.category || productData.category === "") {
      productData.category = null;
    }
    if (!productData.location || productData.location === "") {
      productData.location = null;
    }
    if (!productData.supplier || productData.supplier === "") {
      productData.supplier = null;
    }

    // Handle image - ONLY if file exists
    if (req.file) {
      // Convert to base64 for storage
      const imageBase64 = req.file.buffer.toString('base64');
      productData.image = `data:${req.file.mimetype};base64,${imageBase64}`;
      console.log("✅ Image added, size:", req.file.buffer.length);
    }

    console.log("Saving product:", productData);

    const newProduct = await Product.create(productData);
    
    console.log("✅ Product created:", newProduct.id);
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("❌ Error creating product:", err);
    
    // Handle validation errors
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: err.errors.map(e => e.message)
      });
    }
    
    // Handle unique constraint error
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: "Duplicate SKU or barcode"
      });
    }
    
    res.status(400).json({ message: err.message });
  }
});

// PUT update product
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    console.log("Updating product:", req.params.id);
    
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    const updateData = {};
    
    // Copy all fields from req.body
    for (let key in req.body) {
      updateData[key] = req.body[key];
    }

    // Convert string values to numbers
    if (updateData.stock !== undefined)
      updateData.stock = Number(updateData.stock) || 0;
    if (updateData.costPrice !== undefined)
      updateData.costPrice = Number(updateData.costPrice) || 0;
    if (updateData.salePrice !== undefined)
      updateData.salePrice = Number(updateData.salePrice) || 0;
    if (updateData.minStockAlert !== undefined)
      updateData.minStockAlert = Number(updateData.minStockAlert) || 10;

    // Handle empty strings
    if (updateData.category === "") updateData.category = null;
    if (updateData.location === "") updateData.location = null;
    if (updateData.supplier === "") updateData.supplier = null;

    // Handle image - ONLY if new file is uploaded
    if (req.file) {
      const imageBase64 = req.file.buffer.toString('base64');
      updateData.image = `data:${req.file.mimetype};base64,${imageBase64}`;
      console.log("✅ New image uploaded");
    }

    await product.update(updateData);

    console.log("✅ Product updated");
    res.json(product);
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    await product.destroy();
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;