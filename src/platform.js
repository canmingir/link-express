const fs = require("fs");

let _express;
let _postgres;
let _dynamodb;

function init(config = {}) {
  require.extensions[".md"] = function (module, filename) {
    module.exports = fs.readFileSync(filename, "utf8").trim();
  };

  const { sequelize, dynamodb } = require("./config").init(config);

  _express = require("./express");

  if (sequelize) {
    _postgres = require("./postgres");
  }

  if (dynamodb) {
    _dynamodb = require("./dynamodb");
  }
}

module.exports = {
  init,
  express: () => _express,
  module: () => ({
    Postgres: _postgres,
    DynamoDB: _dynamodb,
    Kafka: {},
  }),
  require: (pkg) => require(pkg),
};
