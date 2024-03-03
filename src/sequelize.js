const { Sequelize } = require("sequelize");
const config = require("./config");
const {
  sequelize: { uri, debug = false },
} = config();

module.exports = new Sequelize(uri, {
  logging: debug,
});
