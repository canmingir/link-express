const { Sequelize, Model } = require("sequelize");
const config = require("./config");

const {
  postgres: { uri, debug = false, sync },
} = config();

const originalDestroy = Model.prototype.destroy;

Model.prototype.destroy = function (options = {}) {
  return originalDestroy.call(this, {
    ...options,
    individualHooks: true,
  });
};

const sequelize = new Sequelize(process.env.PG || uri, {
  logging: debug,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: false,
    paranoid: false,
  },
});

if (sync) {
  setImmediate(async () => {
    await sequelize.sync({ force: true });
  });
}

module.exports = { sequelize };
