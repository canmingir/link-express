import fs from "fs";
import * as authorization from "./authorization";
import * as error from "./error";
import { Application } from "express";
import { Sequelize } from "sequelize-typescript";

interface ModuleConfig {
  postgres?: Record<string, unknown>;
  dynamodb?: Record<string, unknown>;
  logger?: Record<string, unknown>;
  project?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Logger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let _express: Application;
let _postgres: { sequelize: Sequelize; metrics: Record<string, unknown> };
let _dynamodb: { docClient: Record<string, unknown> };
let _logger: Logger;

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
        _logger = console as unknown as Logger;
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

const module = () => ({
  Postgres: _postgres,
  DynamoDB: _dynamodb,
  Kafka: {},
});

const importModule = (pkg: string) => import(pkg);

export {
  init,
  _express as express,
  module,
  importModule,
  authorization,
  error,
  _logger as logger,
};
