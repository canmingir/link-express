const { Sequelize, Model } = require("sequelize");
const config = require("./config");

const {
  sequelize: { uri, debug = false },
} = config();

const originalDestroy = Model.prototype.destroy;

Model.prototype.destroy = function (options = {}) {
  return originalDestroy.call(this, {
    ...options,
    individualHooks: true,
  });
};

module.exports = new Sequelize(uri, {
  logging: debug,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: true,
    paranoid: true,
  },
});
