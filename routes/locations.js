const express = require("express");
const router = express.Router();
const { Location, Employee } = require("../models");

// GET all
router.get("/", async (req, res) => {
  try {
    const locations = await Location.findAll({
      order: [['name', 'ASC']]
    });
    
    // Populate assigned staff manually
    const locationsWithStaff = await Promise.all(
      locations.map(async (location) => {
        const staffIds = location.assignedStaff || [];
        const staff = await Employee.findAll({
          where: { id: staffIds },
          attributes: ['id', 'name', 'role']
        });
        
        return {
          ...location.toJSON(),
          assignedStaff: staff
        };
      })
    );
    
    res.json(locationsWithStaff);
  } catch (err) {
    console.error("Get locations error:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST
router.post("/", async (req, res) => {
  try {
    const location = await Location.create(req.body);
    
    // Get staff details if any
    let staff = [];
    if (location.assignedStaff && location.assignedStaff.length > 0) {
      staff = await Employee.findAll({
        where: { id: location.assignedStaff },
        attributes: ['id', 'name', 'role']
      });
    }
    
    const populated = {
      ...location.toJSON(),
      assignedStaff: staff
    };
    
    res.status(201).json(populated);
  } catch (err) {
    console.error("Create location error:", err);
    res.status(400).json({ message: err.message });
  }
});

// PUT
router.put("/:id", async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    
    await location.update(req.body);
    
    // Get staff details
    let staff = [];
    if (location.assignedStaff && location.assignedStaff.length > 0) {
      staff = await Employee.findAll({
        where: { id: location.assignedStaff },
        attributes: ['id', 'name', 'role']
      });
    }
    
    const populated = {
      ...location.toJSON(),
      assignedStaff: staff
    };
    
    res.json(populated);
  } catch (err) {
    console.error("Update location error:", err);
    res.status(400).json({ message: err.message });
  }
});

// PATCH toggle active
router.patch("/:id/toggle", async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    
    await location.update({ isActive: req.body.isActive });
    
    // Get staff details
    let staff = [];
    if (location.assignedStaff && location.assignedStaff.length > 0) {
      staff = await Employee.findAll({
        where: { id: location.assignedStaff },
        attributes: ['id', 'name', 'role']
      });
    }
    
    const populated = {
      ...location.toJSON(),
      assignedStaff: staff
    };
    
    res.json(populated);
  } catch (err) {
    console.error("Toggle error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    
    await location.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;