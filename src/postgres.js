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

const sequelize = new Sequelize(uri, {
  logging: debug,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: false,
    paranoid: false,
  },
});

setImmediate(async () => {
  await sequelize.sync({ force: true });
});

module.exports = { sequelize };
