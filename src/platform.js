const fs = require("fs");
const authorization = require("./authorization");
const error = require("./error");

let _express;
let _postgres;
let _dynamodb;
let _logger;

function init(config = {}) {
  return new Promise((resolve, reject) => {
    try {
      require.extensions[".md"] = function (module, filename) {
        module.exports = fs.readFileSync(filename, "utf8").trim();
      };

      const { postgres, dynamodb, logger } = require("./config").init(config);

      _express = require("./express");

      if (logger) {
        _logger = require("./logger");
      } else {
        _logger = console;
      }

      if (postgres) {
        _postgres = require("./postgres");
      }

      if (dynamodb) {
        _dynamodb = require("./dynamodb");
      }

      resolve();
    } catch (err) {
      reject(err);
    }
  });
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
  error,
  get logger() {
    return _logger;
  },
};
