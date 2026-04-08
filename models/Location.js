const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Location name is required" }
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Address is required" }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  assignedStaff: {
    type: DataTypes.INTEGER, // Employee ID
    allowNull: true,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'locations',
  timestamps: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['isActive'] }
  ]
});

module.exports = Location;