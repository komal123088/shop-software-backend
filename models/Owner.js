const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const Owner = sequelize.define('Owner', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Name is required" }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: "Invalid email format" },
      notEmpty: { msg: "Email is required" }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Password is required" }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  shopName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  isOwner: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isRegistered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resetPasswordCode: {
    type: DataTypes.STRING(6),
    allowNull: true
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  tokenVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'owners',
  timestamps: true,
  hooks: {
    beforeCreate: async (owner) => {
      if (owner.password) {
        const salt = await bcrypt.genSalt(10);
        owner.password = await bcrypt.hash(owner.password, salt);
      }
    },
    beforeUpdate: async (owner) => {
      if (owner.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        owner.password = await bcrypt.hash(owner.password, salt);
      }
    }
  },
  indexes: [
    { unique: true, fields: ['email'] }
  ]
});

// Method to compare passwords
Owner.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = Owner;