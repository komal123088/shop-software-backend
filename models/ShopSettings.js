const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ShopSettings = sequelize.define('ShopSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shopName: {
    type: DataTypes.STRING(200),
    defaultValue: "My Shop"
  },
  address: {
    type: DataTypes.TEXT,
    defaultValue: "Main Bazar, City"
  },
  location: {
    type: DataTypes.STRING(200),
    defaultValue: "Lahore, Punjab"
  },
  phone: {
    type: DataTypes.STRING(20),
    defaultValue: "03xx-xxxxxxx"
  },
  whatsapp: {
    type: DataTypes.STRING(20),
    defaultValue: ""
  },
  email: {
    type: DataTypes.STRING(100),
    defaultValue: ""
  },
  about: {
    type: DataTypes.TEXT,
    defaultValue: ""
  },
  logo: {
    type: DataTypes.STRING(255),
    defaultValue: ""
  },
  theme: {
    type: DataTypes.JSON,
    defaultValue: {
      mode: "light",
      primary: "#0d6efd",
      secondary: "#6c757d"
    }
  }
}, {
  tableName: 'shop_settings',
  timestamps: true
});

// Singleton pattern - only one row
ShopSettings.getInstance = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = ShopSettings;