const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM(
      'salary',
      'purchase',
      'utility',
      'office',
      'food',
      'transport',
      'other'
    ),
    allowNull: false,
    validate: {
      isIn: {
        args: [['salary', 'purchase', 'utility', 'office', 'food', 'transport', 'other']],
        msg: "Invalid expense type"
      }
    }
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Category is required" }
    }
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Description is required" }
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0.01], msg: "Amount must be greater than 0" }
    }
  },
  employee: {
    type: DataTypes.STRING(200), // Employee name
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank', 'credit'),
    defaultValue: 'cash'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'expenses',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['date'] },
    { fields: ['category'] }
  ]
});

module.exports = Expense;