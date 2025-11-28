import { ecsFormat } from "@elastic/ecs-pino-format";
import pino from "pino";
import pinoElastic from "pino-elasticsearch";
import config from "./config";

const { logger: loggerConfig, project } = config();

if (!loggerConfig || !project) {
  throw new Error("Logger and project configuration are required");
}

const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

const streamToElastic = pinoElastic({
  index: loggerConfig.elasticsearch.index,
  node: loggerConfig.elasticsearch.node,
  esVersion: loggerConfig.elasticsearch.esVersion || 8,
  flushBytes: loggerConfig.elasticsearch.flushBytes || 1000,
} as Parameters<typeof pinoElastic>[0]);

streams.push({ stream: streamToElastic });

const logger = pino(
  {
    ...ecsFormat(),
    base: {
      service: {
        name: project.name,
        version: project.version,
      },
    },
  },
  pino.multistream(streams)
);

export = logger;
