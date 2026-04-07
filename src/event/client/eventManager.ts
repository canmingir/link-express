import { Callback, EventAdapter, InitOptions } from "./types/types";
import { EventMetrics, PushgatewayConfig } from "./metrics";

import { KafkaAdapter } from "./adapters/KafkaAdapter";
import { SocketAdapter } from "./adapters/SocketAdapter";
import { logEvent } from "../eventLogger";

const TOPICS = [
  "KNOWLEDGE_CREATED",
  "MESSAGE_USER_MESSAGED",
  "SESSION_USER_MESSAGED",
  "TASK_CREATED",
  "STEP_ADDED",
  "STEP_COMPLETED",
  "MESSAGE_ASSISTANT_MESSAGED",
  "RESPONSIBILITY_CREATED",
  "RESPONSIBILITY_DESCRIPTION_GENERATED",
  "SESSION_INITIATED",
  "SESSION_AI_MESSAGED",
  "SUPERVISING_RAISED",
  "SUPERVISING_ANSWERED",
  "TASK_COMPLETED",
  "KNOWLEDGES_LOADED",
  "MESSAGES_LOADED",
];
export class EventManager {
  private adapter: EventAdapter | null = null;
  private callbacks: Map<string, Set<Callback<object>>> = new Map();
  private metrics = new EventMetrics();
  private backlogInterval: NodeJS.Timeout | null = null;

  async init(options: InitOptions): Promise<void> {
    if (this.adapter) {
      await this.disconnect();
    }
    switch (options.type) {
      case "inMemory":
        this.adapter = new SocketAdapter({
          host: options.host,
          port: options.port,
          protocol: options.protocol,
        });
        break;
      case "kafka":
        this.adapter = new KafkaAdapter({
          clientId: options.clientId,
          brokers: options.brokers,
          groupId: options.groupId,
          partitionsConsumedConcurrently: options.partitionsConsumedConcurrently,
        });
        this.startBacklogMonitoring();
        break;

      default:
        throw new Error(`Unknown adapter type`);
    }
    await this.adapter.connect();

    this.adapter.onMessage((type, payload) => {
      this.executeCallbacks(type, payload);
    });
  }

  async publish<T extends object = object>(
    ...args: [...string[], T]
  ): Promise<void> {
    if (args.length < 2) {
      throw new Error("publish requires at least one event type and a payload");
    }
    if (!this.adapter) {
      throw new Error("Event system not initialized");
    }

    const payload = args[args.length - 1];
    const typeParts = args.slice(0, -1);
    const mergedType = typeParts.join("_");

    this.validateEventType(mergedType);

    logEvent("publish", mergedType, payload);

    const payloadSize = this.getPayloadSize(payload);
    const endTimer = this.metrics.recordPublish(mergedType, payloadSize);
    try {
      await this.adapter.publish(mergedType, payload);
      if (this.adapter instanceof SocketAdapter) {
        this.executeCallbacks(mergedType, payload);
      }
      endTimer();
    } catch (error) {
      this.metrics.recordPublishError(mergedType, "publish_error");
      endTimer();
      throw error;
    }
  }

  async subscribe<T extends object = object>(
    type: string,
    callback: Callback<T>,
  ): Promise<() => void> {
    logEvent("subscribe", type);
    this.validateEventType(type);

    const callbackSet = this.getOrCreateCallbackSet(type);
    const callbackWrapper: Callback<object> = (payload: object) => {
      callback(payload as T);
    };

    callbackSet.add(callbackWrapper);

    this.metrics.updateSubscriptions(type, callbackSet.size);

    if (this.adapter && callbackSet.size === 1) {
      await this.adapter.subscribe(type);
    }

    return async () => {
      callbackSet.delete(callbackWrapper);

      if (callbackSet.size === 0) {
        this.callbacks.delete(type);
        if (this.adapter) {
          await this.adapter.unsubscribe(type);
        }
      }

      this.metrics.updateSubscriptions(type, callbackSet.size);
    };
  }

  async disconnect(): Promise<void> {
    this.stopBacklogMonitoring();

    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }

    this.callbacks.clear();
  }

  private executeCallbacks(type: string, payload: object): void {
    const callbackSet = this.callbacks.get(type);
    if (!callbackSet) return;

    for (const callback of callbackSet) {
      setTimeout(() => {
        const endTimer = this.metrics.recordCallback(type);
        try {
          const maybePromise = callback(payload) as unknown;
          if (
            maybePromise &&
            typeof maybePromise === "object" &&
            "then" in maybePromise &&
            typeof (maybePromise as Promise<unknown>).then === "function"
          ) {
            (maybePromise as Promise<unknown>)
              .catch((error) => {
                console.error(`Error executing callback for ${type}:`, error);
              })
              .finally(() => {
                endTimer();
              });
            return;
          }
        } catch (error) {
          console.error(`Error executing callback for ${type}:`, error);
        }
        endTimer();
      }, 0);
    }
  }

  private validateEventType(type: string): void {
    if (
      type === "__proto__" ||
      type === "constructor" ||
      type === "prototype"
    ) {
      throw new Error("Invalid event type");
    }
  }

  private startBacklogMonitoring(intervalMs: number = 60000): void {
    if (!this.adapter || typeof this.adapter.getBacklog !== "function") return;

    this.updateBacklogMetrics();

    this.backlogInterval = setInterval(() => {
      this.updateBacklogMetrics();
    }, intervalMs);
  }

  private stopBacklogMonitoring(): void {
    if (this.backlogInterval) {
      clearInterval(this.backlogInterval);
      this.backlogInterval = null;
    }
  }

  private async updateBacklogMetrics(): Promise<void> {
    if (!this.adapter || typeof this.adapter.getBacklog !== "function") return;

    try {
      const backlog = await this.adapter.getBacklog(TOPICS);
      backlog.forEach((size, topic) => {
        this.metrics.updateEventBacklog(topic, size);
      });
    } catch {
      console.error("Error updating backlog metrics");
    }
  }

  async checkBacklog(): Promise<void> {
    await this.updateBacklogMetrics();
  }

  private getOrCreateCallbackSet(type: string): Set<Callback<object>> {
    let callbackSet = this.callbacks.get(type);
    if (!callbackSet) {
      callbackSet = new Set();
      this.callbacks.set(type, callbackSet);
    }
    return callbackSet;
  }

  private getPayloadSize(payload: object): number {
    try {
      return JSON.stringify(payload).length;
    } catch {
      return 0;
    }
  }

  startPushgateway(config?: PushgatewayConfig): void {
    this.metrics.startPushgateway(config);
  }

  stopPushgateway(): void {
    this.metrics.stopPushgateway();
  }

  async pushMetricsToGateway(): Promise<void> {
    await this.metrics.pushMetricsToGateway();
  }

  getPushgatewayConfig(): PushgatewayConfig | undefined {
    return this.metrics.getPushgatewayConfig();
  }
}
