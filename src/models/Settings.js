const { sequelize } = require("../postgres");
const { DataTypes, UUIDV4 } = require("sequelize");

const Settings = sequelize.define("Settings", {
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
  settings: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
});

module.exports = Settings;
