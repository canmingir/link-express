let _express;
let _sequelize;
let _docClient;

function init(config = {}) {
  const { sequelize, dynamodb } = require("./config").init(config);

  _express = require("./express");

  if (sequelize) {
    _sequelize = require("./sequelize");
  }

  if (dynamodb) {
    _docClient = require("./dynamodb");
  }
}

module.exports = () => ({ sequelize: _sequelize, docClient: _docClient });
module.exports.init = init;
module.exports.express = () => _express;
