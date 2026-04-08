const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  supplierName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Supplier name is required" }
    }
  },
  supplierPhone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: ''
  },
  itemDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Item description is required" }
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Quantity cannot be negative" }
    }
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'Piece'
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Purchase price cannot be negative" }
    }
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Total amount cannot be negative" }
    }
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Amount paid cannot be negative" }
    }
  },
  remainingAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Remaining amount cannot be negative" }
    }
  },
  purchaseDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'inventory_purchases',
  timestamps: true,
  hooks: {
    beforeValidate: (inventory) => {
      // Calculate total amount
      if (inventory.quantity && inventory.purchasePrice) {
        inventory.totalAmount = Number(inventory.quantity) * Number(inventory.purchasePrice);
      }
    },
    beforeSave: (inventory) => {
      // Calculate remaining amount
      inventory.remainingAmount = Number(inventory.totalAmount) - Number(inventory.amountPaid);
      
      // Ensure remaining amount is not negative
      if (inventory.remainingAmount < 0) {
        inventory.remainingAmount = 0;
      }
    }
  },
  indexes: [
    { fields: ['supplierName'] },
    { fields: ['purchaseDate'] }
  ]
});

module.exports = Inventory;