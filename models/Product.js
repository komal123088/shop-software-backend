const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Product name is required" }
    }
  },
  sku: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: true,
    validate: {
      len: { args: [0, 50], msg: "SKU too long" }
    }
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Stock cannot be negative" }
    }
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Cost price cannot be negative" }
    }
  },
  salePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: "Sale price cannot be negative" }
    }
  },
  minStockAlert: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    validate: {
      min: { args: [0], msg: "Minimum stock alert cannot be negative" }
    }
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  supplier: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  image: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    { fields: ['sku'] },
    { fields: ['barcode'] },
    { fields: ['category'] },
    { fields: ['name'] }
  ]
});

module.exports = Product;