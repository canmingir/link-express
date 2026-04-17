export type EventPayload = Record<string, unknown> | Record<string, unknown>[];

export type Callback<T = EventPayload> = (payload: T) => void;

export interface EventAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(type: string, payload: EventPayload): Promise<void>;
  subscribe(type: string): Promise<void>;
  unsubscribe(type: string): Promise<void>;
  onMessage(handler: (type: string, payload: EventPayload) => void): void;
  getBacklog?(topics: string[]): Promise<Map<string, number>>;
}

export interface BaseInitOptions {
  type: "inMemory" | "kafka";
}

export interface InMemoryOptions extends BaseInitOptions {
  type: "inMemory";
  host: string;
  port?: number;
  protocol: string;
}

export interface KafkaOptions extends BaseInitOptions {
  type: "kafka";
  clientId: string;
  brokers: string[];
  groupId: string;
  partitionsConsumedConcurrently?: number;
}

export type InitOptions = InMemoryOptions | KafkaOptions;
