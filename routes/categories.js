const express = require("express");
const router = express.Router();
const { Category, sequelize } = require("../models");
const { Op } = require("sequelize");

// ============================================
// GET all categories
// ============================================
router.get("/", async (req, res) => {
  try {
    console.log("📥 Fetching all categories...");
    
    const categories = await Category.findAll({
      order: [['name', 'ASC']]
    });
    
    console.log(`✅ Found ${categories.length} categories`);
    res.json(categories);
  } catch (err) {
    console.error("❌ GET categories error:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
});

// ============================================
// POST new category
// ============================================
router.post("/", async (req, res) => {
  try {
    const { name, isActive } = req.body;
    
    console.log("📝 Creating new category:", { name, isActive });
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        message: "Category name is required" 
      });
    }

    // Check if category already exists (case-insensitive for MySQL)
    const existing = await Category.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        sequelize.fn('LOWER', name.trim())
      )
    });
    
    if (existing) {
      console.log("⚠️ Category already exists:", existing.name);
      return res.status(400).json({ 
        message: "Category already exists" 
      });
    }

    // Create new category
    const category = await Category.create({ 
      name: name.trim(), 
      isActive: isActive !== false 
    });
    
    console.log("✅ Category created successfully:", category.id);
    res.status(201).json(category);
    
  } catch (err) {
    console.error("❌ POST category error:", err);
    
    // Handle specific Sequelize errors
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: "Category already exists" 
      });
    }
    
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: err.errors.map(e => e.message)
      });
    }
    
    res.status(500).json({ 
      message: "Failed to save category", 
      error: err.message 
    });
  }
});

// ============================================
// PUT update category
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, isActive } = req.body;
    
    console.log("✏️ Updating category ID:", categoryId, "with:", { name, isActive });
    
    // Find category by ID
    const category = await Category.findByPk(categoryId);
    
    if (!category) {
      console.log("⚠️ Category not found with ID:", categoryId);
      return res.status(404).json({ 
        message: "Category not found" 
      });
    }
    
    // If name is being changed, check if new name already exists
    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          sequelize.fn('LOWER', name.trim())
        )
      });
      
      if (existing && existing.id !== parseInt(categoryId)) {
        console.log("⚠️ Another category already exists with name:", name);
        return res.status(400).json({ 
          message: "Category name already exists" 
        });
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Update category
    await category.update(updateData);
    
    console.log("✅ Category updated successfully:", category.id);
    res.json(category);
    
  } catch (err) {
    console.error("❌ Update category error:", err);
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: "Category name already exists" 
      });
    }
    
    res.status(500).json({ 
      message: "Update failed", 
      error: err.message 
    });
  }
});

// ============================================
// PATCH toggle active status
// ============================================
router.patch("/:id/toggle", async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { isActive } = req.body;
    
    console.log("🔄 Toggling category ID:", categoryId, "to isActive:", isActive);
    
    // Find category by ID
    const category = await Category.findByPk(categoryId);
    
    if (!category) {
      console.log("⚠️ Category not found with ID:", categoryId);
      return res.status(404).json({ 
        message: "Category not found" 
      });
    }
    
    // Update active status
    await category.update({ isActive });
    
    console.log("✅ Category toggled successfully:", category.id, "isActive:", category.isActive);
    res.json(category);
    
  } catch (err) {
    console.error("❌ Toggle error:", err);
    res.status(500).json({ 
      message: "Toggle failed", 
      error: err.message 
    });
  }
});

// ============================================
// DELETE category
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    console.log("🗑️ Deleting category ID:", categoryId);
    
    // Find category by ID
    const category = await Category.findByPk(categoryId);
    
    if (!category) {
      console.log("⚠️ Category not found with ID:", categoryId);
      return res.status(404).json({ 
        message: "Category not found" 
      });
    }
    
    // Delete category
    await category.destroy();
    
    console.log("✅ Category deleted successfully:", categoryId);
    res.json({ 
      message: "Category deleted successfully",
      id: categoryId 
    });
    
  } catch (err) {
    console.error("❌ Delete error:", err);
    
    // Handle foreign key constraint errors
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ 
        message: "Cannot delete category because it is used by products" 
      });
    }
    
    res.status(500).json({ 
      message: "Delete failed", 
      error: err.message 
    });
  }
});

// ============================================
// GET single category by ID
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    console.log("📥 Fetching category ID:", categoryId);
    
    const category = await Category.findByPk(categoryId);
    
    if (!category) {
      console.log("⚠️ Category not found with ID:", categoryId);
      return res.status(404).json({ 
        message: "Category not found" 
      });
    }
    
    console.log("✅ Category found:", category.name);
    res.json(category);
    
  } catch (err) {
    console.error("❌ GET category error:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
});

module.exports = router;