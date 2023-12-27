const { Sequelize } = require("sequelize");
const config = require("../config");

let database;
function init({ db, models }) {
  database = new Sequelize(db, {
    logging: config.get().debug === true,
  });

  if (models) models.init(database);
  return database;
}

function get() {
  return database;
}

module.exports = { init, get };
