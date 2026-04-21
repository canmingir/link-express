import client from "prom-client";
import { v4 as uuid } from "uuid";
import { logEvent } from "../eventLogger";

export interface SubscriptionRegistry {
  readonly id: string;
  readonly type: string;
  readonly callback: (payload: object, registry: SubscriptionRegistry) => void;
  unsubscribe(): void;
}

type SubscriptionBucket = Record<string, SubscriptionRegistry>;

const subscriptions: Record<string, SubscriptionBucket> = Object.create(null);
const messages = new Map<string, object>();
const INVALID_TYPES = new Set(["__proto__", "constructor", "prototype"]);
type EventInputArg = string | object | SubscriptionRegistry["callback"];

const eventPublishCounter = new client.Counter({
  name: "events_published_total",
  help: "Total number of events published",
  labelNames: ["event_type"],
});

const eventSubscriptionGauge = new client.Gauge({
  name: "active_event_subscriptions",
  help: "Number of active event subscriptions",
  labelNames: ["event_type"],
});

const eventPublishDuration = new client.Histogram({
  name: "event_publish_duration_seconds",
  help: "Time taken to publish events",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const eventPayloadSize = new client.Histogram({
  name: "event_payload_size_bytes",
  help: "Size of event payloads in bytes",
  labelNames: ["event_type"],
  buckets: [10, 100, 1000, 10000, 100000, 1000000],
});

const eventPublishErrors = new client.Counter({
  name: "event_publish_errors_total",
  help: "Total number of event publish errors",
  labelNames: ["event_type", "error_type"],
});

const callbackProcessingDuration = new client.Histogram({
  name: "event_callback_duration_seconds",
  help: "Time taken to process event callbacks",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const subscriptionRate = new client.Counter({
  name: "event_subscriptions_total",
  help: "Total number of event subscriptions created",
  labelNames: ["event_type"],
});

const unsubscriptionRate = new client.Counter({
  name: "event_unsubscriptions_total",
  help: "Total number of event unsubscriptions",
  labelNames: ["event_type"],
});

const eventThroughput = new client.Counter({
  name: "event_callbacks_processed_total",
  help: "Total number of event callbacks processed successfully",
  labelNames: ["event_type"],
});

const subscribe = (...args: EventInputArg[]): SubscriptionRegistry => {
  const { type, callback } = parseSubscribeArgs(args);
  assertValidType(type, "Invalid subscription type");

  logEvent("subscribe", type);

  const id = uuid();
  let isActive = true;

  const bucket = subscriptions[type] ?? (subscriptions[type] = Object.create(null));

  const registry: SubscriptionRegistry = {
    id,
    type,
    callback,
    unsubscribe: () => {
      if (!isActive) {
        return;
      }
      isActive = false;

      const currentBucket = subscriptions[type];
      if (!currentBucket || !currentBucket[id]) {
        return;
      }

      delete currentBucket[id];
      unsubscriptionRate.labels(type).inc();

      const remaining = Object.keys(currentBucket).length;
      if (remaining === 0) {
        delete subscriptions[type];
        eventSubscriptionGauge.labels(type).set(0);
        return;
      }

      eventSubscriptionGauge.labels(type).set(remaining);
    },
  };

  bucket[id] = registry;

  subscriptionRate.labels(type).inc();
  eventSubscriptionGauge.labels(type).set(Object.keys(bucket).length);

  return registry;
};

const publish = (...args: EventInputArg[]): void => {
  const { type, payload } = parsePublishArgs(args);
  assertValidType(type, "Invalid publish type");

  logEvent("publish", type, payload);
  messages.set(type, payload);

  const endTimer = eventPublishDuration.labels(type).startTimer();
  eventPublishCounter.labels(type).inc();
  eventPayloadSize.labels(type).observe(getPayloadSize(payload));

  for (const registry of Object.values(subscriptions[type] ?? {})) {
    setTimeout(() => {
      const callbackTimer = callbackProcessingDuration.labels(type).startTimer();
      try {
        registry.callback(payload, registry);
        eventThroughput.labels(type).inc();
      } catch (err) {
        const errorName = err instanceof Error ? err.name : "UnknownError";
        eventPublishErrors.labels(type, errorName).inc();
      } finally {
        callbackTimer();
      }
    }, 0);
  }

  endTimer();
};

function last<T extends object = object>(type: string, init?: T): T | undefined {
  if (messages.has(type)) {
    return messages.get(type) as T;
  }
  return init;
}

function parseSubscribeArgs(args: EventInputArg[]): {
  type: string;
  callback: SubscriptionRegistry["callback"];
} {
  if (args.length < 2) {
    throw new Error("subscribe requires at least 2 arguments");
  }

  const callback = args[args.length - 1];
  if (typeof callback !== "function") {
    throw new Error("subscribe requires a callback as the last argument");
  }
  const typedCallback = callback as SubscriptionRegistry["callback"];

  const typeParts = args.slice(0, -1);
  if (!typeParts.every((part) => typeof part === "string" && part.length > 0)) {
    throw new Error("subscribe event type parts must be non-empty strings");
  }

  return {
    type: typeParts.join("."),
    callback: typedCallback,
  };
}

function parsePublishArgs(args: EventInputArg[]): { type: string; payload: object } {
  if (args.length < 2) {
    throw new Error("publish requires at least 2 arguments");
  }

  const typeParts = args.slice(0, -1);
  const payload = args[args.length - 1];

  if (!typeParts.every((part) => typeof part === "string" && part.length > 0)) {
    throw new Error("publish event type parts must be non-empty strings");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("publish payload must be a non-null object");
  }

  return {
    type: typeParts.join("."),
    payload,
  };
}

function assertValidType(type: string, errorMessage: string): void {
  if (INVALID_TYPES.has(type)) {
    throw new Error(errorMessage);
  }
}

function getPayloadSize(payload: object): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

export { subscribe, publish, messages, last, client };
