const fs = require("fs");
const authorization = require("./authorization");

let _express;
let _postgres;
let _dynamodb;

function init(config = {}) {
  require.extensions[".md"] = function (module, filename) {
    module.exports = fs.readFileSync(filename, "utf8").trim();
  };

  const { postgres, dynamodb } = require("./config").init(config);

  _express = require("./express");

  if (postgres) {
    _postgres = require("./postgres");
    //TODO can we do this more elegantly?
    //eslint-disable-next-line
    const Permission = require("./models/Permission");
  }

  if (dynamodb) {
    _dynamodb = require("./dynamodb");
  }

  return new Promise((resolve) => resolve());
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
  authorization,
};
