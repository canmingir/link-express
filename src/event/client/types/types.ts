export type Callback<T = object> = (payload: T) => void;

export interface EventAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(type: string, payload: object): Promise<void>;
  subscribe(type: string): Promise<void>;
  unsubscribe(type: string): Promise<void>;
  onMessage(handler: (type: string, payload: object) => void): void;
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
}

export type InitOptions = InMemoryOptions | KafkaOptions;
