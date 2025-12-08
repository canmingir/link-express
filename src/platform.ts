import * as authorization from "./authorization";
import * as error from "./error";
import { Application } from "express";
import { Sequelize } from "sequelize-typescript";
import { Config } from "./config";

let _express: Application;
let _postgres: { sequelize: Sequelize };
let _dynamodb: any;
let _logger: any;

async function init(config: Partial<Config> = {}): Promise<void> {
  const configModule = await import("./config.ts");
  const { postgres, dynamodb, logger } = configModule.init(config as Config);

  const expressModule = await import("./express.ts");
  _express = (expressModule as any).default as Application;

  if (logger) {
    const loggerModule = await import("./logger.ts");
    _logger = (loggerModule as any).default;
  } else {
    _logger = console;
  }

  if (postgres) {
    const postgresModule = await import("./postgres.ts");
    _postgres = { sequelize: postgresModule.sequelize };
  }

  if (dynamodb) {
    const dynamodbModule = await import("./dynamodb.ts");
    _dynamodb = { docClient: dynamodbModule.docClient };
  }
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
  getModules,
  importModule,
  authorization,
  error,
  _logger as logger,
};
