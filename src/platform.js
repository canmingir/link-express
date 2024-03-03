let _app;
let _sequelize;
let _docClient;

function init(config) {
  const { sequelize, dynamodb } = require("./config").init(config);

  _app = require("./app");

  if (sequelize) {
    _sequelize = require("./sequelize");
  }

  if (dynamodb) {
    _docClient = require("./dynamodb");
  }
}

module.exports = {
  init,
  app: _app,
  sequelize: _sequelize,
  dynamodb: _docClient,
};
