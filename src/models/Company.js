const { sequelize } = require("../postgres");
const { DataTypes, UUIDV4 } = require("sequelize");

const Company = sequelize.define("Company", {
  id: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Company;
