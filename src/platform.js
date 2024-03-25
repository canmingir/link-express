const fs = require("fs");

let _express;
let _sequelize;
let _docClient;

function init(config = {}) {
  require.extensions[".md"] = function (module, filename) {
    module.exports = fs.readFileSync(filename, "utf8").trim();
  };

  const { sequelize, dynamodb } = require("./config").init(config);

  _express = require("./express");

  if (sequelize) {
    _sequelize = require("./sequelize");
  }

  if (dynamodb) {
    _docClient = require("./dynamodb");
  }
}

module.exports = {
  init,
  express: () => _express,
  module: () => ({
    Postgres: {
      sequelize: _sequelize,
    },
    DynamoDB: {
      docClient: _docClient,
    },
    Kafka: {},
  }),
  require: (pkg) => require(pkg),
};
