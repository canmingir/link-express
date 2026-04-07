import { ecsFormat } from "@elastic/ecs-pino-format";
import pino from "pino";
import pinoElastic from "pino-elasticsearch";
import { getConfig } from "../config";

let logger: pino.Logger | null = null;
let isElasticsearchConfigured = false;

function getLogger(): pino.Logger | null {
  const { logger: loggerConfig, project } = getConfig();

  if (!loggerConfig || !project) {
    isElasticsearchConfigured = false;
    return null;
  }

  if (!logger || !isElasticsearchConfigured) {
    const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

    const eventsIndex = `${loggerConfig.elasticsearch.index}-events`;

    const streamToElastic = pinoElastic({
      index: eventsIndex,
      node: loggerConfig.elasticsearch.node,
      esVersion: loggerConfig.elasticsearch.esVersion || 8,
      flushBytes: loggerConfig.elasticsearch.flushBytes || 1000,
    } as Parameters<typeof pinoElastic>[0]);

    streamToElastic.on("error", (err: Error) => {
      console.error("[EventLogger] Elasticsearch error:", err.message);
    });

    streamToElastic.on("insertError", (err: Error) => {
      console.error("[EventLogger] Elasticsearch insert error:", err);
    });

    streams.push({ stream: streamToElastic });

    logger = pino(
      {
        ...ecsFormat(),
        base: {
          service: {
            name: project.name,
            version: project.version,
          },
        },
      },
      pino.multistream(streams),
    );

    isElasticsearchConfigured = true;
  }

  return logger;
}

export function logEvent(
  action: "publish" | "subscribe",
  topic: string,
  payload?: unknown,
) {
  const log = getLogger();

  if (log) {
    log.info({
      action,
      topic,
      event_payload: payload ? JSON.stringify(payload) : undefined,
    });
  } else {
    console.log(`[Event] ${action}:`, topic, payload || "");
  }
}
