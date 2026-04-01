import * as client from "prom-client";

import { Callback, InitOptions } from "./types/types";
import { EventMetrics, PushgatewayConfig } from "./metrics";

import { EventManager } from "./eventManager";
import { KafkaAdapter } from "./adapters/KafkaAdapter";
import { SocketAdapter } from "./adapters/SocketAdapter";

const manager = new EventManager();

export const event = {
  init: (options: InitOptions) => manager.init(options),
  publish: <T extends object = object>(...args: [...string[], T]) =>
    manager.publish(...args),
  subscribe: <T extends object = object>(type: string, callback: Callback<T>) =>
    manager.subscribe(type, callback),
  disconnect: () => manager.disconnect(),
  checkBacklog: () => manager.checkBacklog(),

  startBacklogMonitoring: () => {
    console.log("Backlog monitoring starts automatically with Kafka adapter");
  },
  stopBacklogMonitoring: () => {
    console.log("Backlog monitoring stops automatically on disconnect");
  },
  restartKafkaConsumer: async () => {
    console.log("Consumer restart is handled automatically");
  },

  startPushgateway: (config?: PushgatewayConfig) =>
    manager.startPushgateway(config),
  stopPushgateway: () => manager.stopPushgateway(),
  pushMetricsToGateway: () => manager.pushMetricsToGateway(),
  getPushgatewayConfig: () => manager.getPushgatewayConfig(),
};

export { client };

export { EventManager, EventMetrics, SocketAdapter, KafkaAdapter };
export type { PushgatewayConfig };
export * from "./types/types";
