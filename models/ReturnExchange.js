const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ReturnExchange = sequelize.define(
  "ReturnExchange",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    returnNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    originalSaleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: "return",
    },
    reason: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    // JSON: [{ productId, name, qty, price, condition }]
    items: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    exchangeItems: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    returnAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    exchangeAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    balanceDue: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    refundMethod: {
      type: DataTypes.STRING,
      defaultValue: "cash",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "completed",
    },
  },
  {
    tableName: "returnexchanges",
    timestamps: true,
  },
);

module.exports = ReturnExchange;
