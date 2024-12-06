const { sequelize } = require("../postgres");
const { DataTypes, UUIDV4 } = require("sequelize");

const Setting = sequelize.define("Setting", {
  id: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  teamId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
});

module.exports = Setting;
