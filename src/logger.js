const { ecsFormat } = require("@elastic/ecs-pino-format");
const pino = require("pino");
const pinoElastic = require("pino-elasticsearch");

const config = require("./config");

const { logger: loggerConfig, project } = config();

const streams = [{ stream: process.stdout }];

const streamToElastic = pinoElastic({
  index: loggerConfig.elasticsearch.index,
  consistency: loggerConfig.elasticsearch.consistency || "one",
  node: loggerConfig.elasticsearch.node,
  esVersion: loggerConfig.elasticsearch.esVersion || 8,
  flushBytes: loggerConfig.elasticsearch.flushBytes || 1000,
});

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

module.exports = logger;
