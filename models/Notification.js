const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM(
      'success',
      'error',
      'warning',
      'info',
      'low-stock',
      'new-credit',
      'employee-added',
      'salary-paid',
      'credit-due'
    ),
    allowNull: false,
    validate: {
      isIn: {
        args: [[
          'success', 'error', 'warning', 'info',
          'low-stock', 'new-credit', 'employee-added',
          'salary-paid', 'credit-due'
        ]],
        msg: "Invalid notification type"
      }
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Message is required" }
    }
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  emailSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailData: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  sendEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false, // Only createdAt, no updatedAt
  indexes: [
    { fields: ['type'] },
    { fields: ['isRead'] },
    { fields: ['timestamp'] }
  ]
});

module.exports = Notification;