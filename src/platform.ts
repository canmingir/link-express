import fs from "fs";
import * as authorization from "./authorization";
import * as error from "./error";
import { Express } from "express";
import { Sequelize } from "sequelize-typescript";
import pino from "pino";

interface ModuleConfig {
  postgres?: Record<string, unknown>;
  dynamodb?: Record<string, unknown>;
  logger?: Record<string, unknown>;
  project?: Record<string, unknown>;
  [key: string]: unknown;
}

let _express: Express;
let _postgres: { sequelize: Sequelize; metrics: Record<string, unknown> };
let _dynamodb: { docClient: Record<string, unknown> };
let _logger: typeof pino | typeof console;

function init(config: ModuleConfig = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      require.extensions[".md"] = function (
        module: NodeJS.Module,
        filename: string
      ) {
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

export = {
  init,
  express: () => _express,
  module: () => ({
    Postgres: _postgres,
    DynamoDB: _dynamodb,
    Kafka: {},
  }),
  require: (pkg: string) => require(pkg),
  authorization,
  error,
  get logger() {
    return _logger;
  },
};
