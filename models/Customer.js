const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Customer name is required" }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
    validate: {
      len: {
        args: [0, 20],
        msg: "Phone number too long"
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: { msg: "Invalid email format" }
    }
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    defaultValue: 'male'
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cnic: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  creditLimit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 50000,
    validate: {
      min: { args: [0], msg: "Credit limit cannot be negative" }
    }
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  totalPurchases: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Total purchases cannot be negative" }
    }
  },
  totalPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Total paid cannot be negative" }
    }
  },
  remainingDue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Remaining due cannot be negative" }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'customers',
  timestamps: true,
  indexes: [
    { fields: ['phone'] },
    { fields: ['email'] },
    { fields: ['name'] }
  ]
});

module.exports = Customer;