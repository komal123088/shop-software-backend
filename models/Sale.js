const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Sale = sequelize.define(
  "Sale",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "customers",
        key: "id",
      },
    },
    customerInfo: {
      type: DataTypes.JSON,
      // ✅ FIX: Auto parse if MySQL returns it as string
      get() {
        const val = this.getDataValue("customerInfo");
        if (!val) return null;
        if (typeof val === "object") return val;
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      },
      set(val) {
        if (!val) {
          this.setDataValue("customerInfo", null);
        } else if (typeof val === "string") {
          // Store as-is if already string, MySQL will handle it
          this.setDataValue("customerInfo", val);
        } else {
          this.setDataValue("customerInfo", val);
        }
      },
    },
    saleType: {
      type: DataTypes.ENUM("cash", "permanent", "temporary"),
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
    },
    discountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },
    serviceCharge: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "sales",
    timestamps: true,
    indexes: [
      { fields: ["customerId"] },
      { fields: ["saleType"] },
      { fields: ["createdAt"] },
    ],
  },
);

module.exports = Sale;
