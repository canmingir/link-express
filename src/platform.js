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
    Postgres: _sequelize,
    DynamoDB: {
      docClient: _docClient,
    },
    Kafka: {},
  }),
  require: (pkg) => {
    if (pkg === "express") {
      return require("express");
    }

    if (pkg === "sequelize") {
      return require("sequelize");
    }

    if (pkg === "@aws-sdk/lib-dynamodb") {
      return require("@aws-sdk/lib-dynamodb");
    }

    if (pkg === "@aws-sdk/client-dynamodb") {
      return require("@aws-sdk/client-dynamodb");
    }

    throw new Error(`Cannot find module '${pkg}'`);
  },
};
