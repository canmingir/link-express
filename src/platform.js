const fs = require("fs");
const authorization = require("./authorization");

let _express;
let _postgres;
let _dynamodb;

function init(config = {}) {
  return new Promise((resolve, reject) => {
    try {
      require.extensions[".md"] = function (module, filename) {
        module.exports = fs.readFileSync(filename, "utf8").trim();
      };

      const { postgres, dynamodb } = require("./config").init(config);

      _express = require("./express");

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
};
