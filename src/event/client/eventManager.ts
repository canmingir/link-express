import { Callback, EventAdapter, InitOptions } from "./types/types";
import { EventMetrics, PushgatewayConfig } from "./metrics";

import { KafkaAdapter } from "./adapters/KafkaAdapter";
import { SocketAdapter } from "./adapters/SocketAdapter";
import { TxEventQAdapter } from "./adapters/TxEventQAdapter";

const TOPICS = [
  "KNOWLEDGE_CREATED",
  "MESSAGE_USER_MESSAGED",
  "SESSION_USER_MESSAGED",
  "TASK_CREATED",
  "STEP_ADDED",
  "STEP_COMPLETED",
  "MESSAGE_USER_MESSAGED",
  "MESSAGE_ASSISTANT_MESSAGED",
  "RESPONSIBILITY_CREATED",
  "RESPONSIBILITY_DESCRIPTION_GENERATED",
  "SESSION_INITIATED",
  "SESSION_USER_MESSAGED",
  "SESSION_AI_MESSAGED",
  "SUPERVISING_RAISED",
  "SUPERVISING_ANSWERED",
  "TASK_COMPLETED",
  "KNOWLEDGES_LOADED",
  "MESSAGES_LOADED",
];
export class EventManager {
  private adapter: EventAdapter | null = null;
  private callbacks: Map<string, Set<Callback>> = new Map();
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
          topics: TOPICS,
        });
        this.startBacklogMonitoring();
        break;

      case "txeventq":
        this.adapter = new TxEventQAdapter({
          connectString: options.connectString,
          user: options.user,
          password: options.password,
          instantClientPath: options.instantClientPath,
          walletPath: options.walletPath,
          consumerName: options.consumerName,
          batchSize: options.batchSize,
          waitTime: options.waitTime,
        });
        this.startBacklogMonitoring();
        break;

      default:
        throw new Error(`Unknown adapter type`);
    }
    await this.adapter.connect();

    this.adapter.onMessage((type, payload) => {
      this.handleIncomingMessage(type, payload);
    });
  }

  async publish<T extends object = object>(
    ...args: [...string[], T]
  ): Promise<void> {
    if (args.length < 1) {
      throw new Error("publish requires at least one event type and a payload");
    }
    if (!this.adapter) {
      throw new Error("Event system not initialized");
    }
    const payload = args[args.length - 1] as T;
    const type = args.slice(0, -1) as string[];
    const mergedType = type.join("_");
    this.validateEventType(mergedType);
    const payloadSize = JSON.stringify(payload).length;
    const endTimer = this.metrics.recordPublish(mergedType, payloadSize);
    try {
      await this.adapter.publish(mergedType, payload);
      this.executeCallbacks(mergedType, payload);
      endTimer();
    } catch (error) {
      this.metrics.recordPublishError(mergedType, "publish_error");
      endTimer();
      throw error;
    }
  }

  async subscribe<T extends object = object>(
    type: string,
    callback: Callback<T>
  ): Promise<() => void> {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }

    const callbackSet = this.callbacks.get(type)!;
    callbackSet.add(callback as Callback);

    this.metrics.updateSubscriptions(type, callbackSet.size);

    if (this.adapter && callbackSet.size === 1) {
      await this.adapter.subscribe(type);
    }

    return async () => {
      callbackSet.delete(callback as Callback);

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

  private handleIncomingMessage(type: string, payload: object): void {
    this.executeCallbacks(type, payload);
  }

  private executeCallbacks(type: string, payload: object): void {
    const callbackSet = this.callbacks.get(type);
    if (!callbackSet) return; // No callbacks for this topic - message ignored

    callbackSet.forEach((callback) => {
      setTimeout(() => {
        const endTimer = this.metrics.recordCallback(type);
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in callback for ${type}:`, error);
        }
        endTimer();
      }, 0);
    });
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
    if (!this.adapter) return;

    // Only monitor for adapters that implement meaningful backlog
    const supportsBacklog =
      this.adapter instanceof KafkaAdapter ||
      this.adapter instanceof TxEventQAdapter;

    if (!supportsBacklog) return;

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
    if (!this.adapter) return;

    const supportsBacklog =
      this.adapter instanceof KafkaAdapter ||
      this.adapter instanceof TxEventQAdapter;

    if (!supportsBacklog) return;

    try {
      const backlog = await (
        this.adapter as KafkaAdapter | TxEventQAdapter
      ).getBacklog(TOPICS);
      backlog.forEach((size, topic) => {
        this.metrics.updateEventBacklog(topic, size);
        console.log(`Backlog for topic ${topic}: ${size} messages`);
      });
    } catch (error) {
      console.error("Error updating backlog metrics:", error);
    }
  }

  async checkBacklog(): Promise<void> {
    await this.updateBacklogMetrics();
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
