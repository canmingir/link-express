import * as authorization from "./authorization";
import * as error from "./error";

import { Application, Router } from "express";
import { Config } from "./config";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "pino";
import { Sequelize } from "sequelize-typescript";

let _express: Application;
let _publicRouter: Router;
let _postgres: { sequelize: Sequelize };
let _dynamodb: { docClient: DynamoDBDocumentClient };
let _logger: Logger | Console = console;

async function init(config: Partial<Config> = {}): Promise<void> {
  const configModule = await import("./config");
  const { postgres, dynamodb, logger } = configModule.init(config as Config);

  const expressModule = await import("./express");
  _express = (expressModule as any).default as Application;
  _publicRouter = (expressModule as any).publicRouter as Router;
  const mountRoutes = (expressModule as any).mountRoutes as () => void;

  if (logger) {
    const loggerModule = await import("./logger");
    _logger = (loggerModule as any).default;
  } else {
    _logger = console;
  }

  if (postgres) {
    const postgresModule = await import("./postgres");
    await postgresModule.ready;
    _postgres = { sequelize: postgresModule.sequelize };
  }

  if (dynamodb) {
    const dynamodbModule = await import("./dynamodb");
    _dynamodb = { docClient: dynamodbModule.docClient };
  }
  setImmediate(mountRoutes);
}

const getModules = () => ({
  Postgres: _postgres,
  DynamoDB: _dynamodb,
  Kafka: {},
});

const importModule = (pkg: string) => import(pkg);

export {
  init,
  _express as express,
  _publicRouter as publicRouter,
  getModules,
  importModule,
  authorization,
  error,
  _logger as logger,
};
