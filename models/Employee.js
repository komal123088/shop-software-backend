const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Employee name is required" }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Phone number is required" }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: { msg: "Invalid email format" }
    }
  },
  role: {
    type: DataTypes.ENUM('manager', 'cashier', 'stock_keeper'),
    defaultValue: 'cashier'
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: "Salary cannot be negative" }
    }
  },
  joinDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cnic: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: { msg: "Username is required" },
      len: { args: [3, 50], msg: "Username must be between 3 and 50 characters" }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Password is required" }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  salaryStatus: {
    type: DataTypes.ENUM('paid', 'unpaid'),
    defaultValue: 'unpaid'
  },
  salaryHistory: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  lastPaidMonth: {
    type: DataTypes.STRING(7), // Format: YYYY-MM
    allowNull: true
  }
}, {
  tableName: 'employees',
  timestamps: true,
  hooks: {
    beforeCreate: async (employee) => {
      if (employee.password) {
        const salt = await bcrypt.genSalt(10);
        employee.password = await bcrypt.hash(employee.password, salt);
        console.log("🔒 Password hashed successfully for:", employee.username);
      }
    },
    beforeUpdate: async (employee) => {
      if (employee.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        employee.password = await bcrypt.hash(employee.password, salt);
        console.log("🔒 Password updated and hashed for:", employee.username);
      }
    }
  },
  indexes: [
    { unique: true, fields: ['username'] },
    { fields: ['phone'] },
    { fields: ['role'] }
  ]
});

// Instance method to compare password
Employee.prototype.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

module.exports = Employee;