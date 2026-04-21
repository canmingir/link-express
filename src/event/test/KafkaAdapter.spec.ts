import { strict as assert } from "assert";

type EachMessageHandler = (ctx: {
  topic: string;
  message: { value: Buffer | null };
}) => Promise<void>;

let KafkaAdapterClass: typeof import("../client/adapters/KafkaAdapter").KafkaAdapter;

function makeFakeKafka() {
  let runHandler: EachMessageHandler | undefined;

  const fakeProducer = {
    calls: { connect: 0, disconnect: 0, send: [] as unknown[][] },
    connect: () => { fakeProducer.calls.connect++; return Promise.resolve(); },
    disconnect: () => { fakeProducer.calls.disconnect++; return Promise.resolve(); },
    send: (opts: unknown) => { fakeProducer.calls.send.push([opts]); return Promise.resolve(); },
  };

  const fakeConsumer = {
    calls: { connect: 0, disconnect: 0, subscribe: [] as unknown[][], run: [] as unknown[][], stop: 0 },
    connect: () => { fakeConsumer.calls.connect++; return Promise.resolve(); },
    disconnect: () => { fakeConsumer.calls.disconnect++; return Promise.resolve(); },
    subscribe: (opts: unknown) => { fakeConsumer.calls.subscribe.push([opts]); return Promise.resolve(); },
    run: (opts: { eachMessage: EachMessageHandler }) => {
      fakeConsumer.calls.run.push([opts]);
      runHandler = opts.eachMessage;
      return Promise.resolve();
    },
    stop: () => { fakeConsumer.calls.stop++; return Promise.resolve(); },
    trigger: (ctx: Parameters<EachMessageHandler>[0]) => runHandler?.(ctx),
  };

  const fakeAdmin = {
    calls: { connect: 0, disconnect: 0 },
    fetchOffsets: (_opts: unknown) => Promise.resolve([] as Array<{ topic: string; partitions: Array<{ partition: number; offset: string }> }>),
    fetchTopicOffsets: (_topic: string) => Promise.resolve([] as Array<{ partition: number; offset: string }>),
    connect: () => { fakeAdmin.calls.connect++; return Promise.resolve(); },
    disconnect: () => { fakeAdmin.calls.disconnect++; return Promise.resolve(); },
  };

  return { fakeProducer, fakeConsumer, fakeAdmin };
}

let currentFake: ReturnType<typeof makeFakeKafka>;

before(() => {
  currentFake = makeFakeKafka();
  const kafkaPath = require.resolve("kafkajs");
  require.cache[kafkaPath] = {
    id: kafkaPath, filename: kafkaPath, loaded: true,
    parent: null, children: [], paths: [],
    exports: {
      Kafka: function() {
        return {
          producer: () => currentFake.fakeProducer,
          consumer: () => currentFake.fakeConsumer,
          admin: () => currentFake.fakeAdmin,
        };
      },
    },
  } as NodeModule;

  delete require.cache[require.resolve("../client/adapters/KafkaAdapter")];
  KafkaAdapterClass = require("../client/adapters/KafkaAdapter").KafkaAdapter;
});

const defaultOptions = {
  clientId: "test-client",
  brokers: ["localhost:9092"],
  groupId: "test-group",
  topics: ["TOPIC_A", "TOPIC_B"],
};

describe("KafkaAdapter", () => {
  let adapter: InstanceType<typeof KafkaAdapterClass>;
  let fake: ReturnType<typeof makeFakeKafka>;

  beforeEach(() => {
    fake = makeFakeKafka();
    currentFake = fake;
    adapter = new KafkaAdapterClass(defaultOptions);
  });

  afterEach(async () => {
    try { await adapter.disconnect(); } catch { /* ignore */ }
  });

  describe("connect()", () => {
    it("connects the producer", async () => {
      await adapter.connect();
      assert.strictEqual(fake.fakeProducer.calls.connect, 1);
    });

    it("connects the consumer", async () => {
      await adapter.connect();
      assert.strictEqual(fake.fakeConsumer.calls.connect, 1);
    });

    it("subscribes to all non-internal topics via regex", async () => {
      await adapter.connect();
      assert.strictEqual(fake.fakeConsumer.calls.subscribe.length, 1);
      const subOpts = (fake.fakeConsumer.calls.subscribe[0][0] as { topics: RegExp[] });
      const regex = subOpts.topics[0];
      assert.ok(regex instanceof RegExp);
      assert.ok(regex.test("MY_TOPIC"));
      assert.ok(!regex.test("__consumer_offsets"));
    });

    it("runs the consumer with 1 concurrent partition by default", async () => {
      await adapter.connect();
      const runOpts = fake.fakeConsumer.calls.run[0][0] as { partitionsConsumedConcurrently: number };
      assert.strictEqual(runOpts.partitionsConsumedConcurrently, 1);
    });

    it("uses provided partitionsConsumedConcurrently when configured", async () => {
      adapter = new KafkaAdapterClass({ ...defaultOptions, partitionsConsumedConcurrently: 4 });
      await adapter.connect();
      const runOpts = fake.fakeConsumer.calls.run[0][0] as { partitionsConsumedConcurrently: number };
      assert.strictEqual(runOpts.partitionsConsumedConcurrently, 4);
    });
  });

  describe("message handling (eachMessage)", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("calls onMessage handler with parsed JSON payload for a regular topic", async () => {
      const received: Array<{ type: string; payload: object }> = [];
      adapter.onMessage((type, payload) => received.push({ type, payload }));

      await fake.fakeConsumer.trigger({
        topic: "MY_TOPIC",
        message: { value: Buffer.from(JSON.stringify({ val: 42 })) },
      });

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].type, "MY_TOPIC");
      assert.deepStrictEqual(received[0].payload, { val: 42 });
    });

    it("ignores messages on internal __ topics", async () => {
      const received: unknown[] = [];
      adapter.onMessage(() => received.push(true));

      await fake.fakeConsumer.trigger({
        topic: "__consumer_offsets",
        message: { value: Buffer.from("{}") },
      });

      assert.strictEqual(received.length, 0);
    });

    it("does not crash when message.value is invalid JSON", async () => {
      const received: unknown[] = [];
      adapter.onMessage(() => received.push(true));

      await assert.doesNotReject(() =>
        fake.fakeConsumer.trigger({
          topic: "MY_TOPIC",
          message: { value: Buffer.from("not-json") },
        })!
      );
      assert.strictEqual(received.length, 0);
    });

    it("does not crash when message.value is null", async () => {
      await assert.doesNotReject(() =>
        fake.fakeConsumer.trigger({ topic: "MY_TOPIC", message: { value: null } })!
      );
    });
  });

  describe("publish()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Producer not connected/);
    });

    it("calls producer.send with the correct topic and JSON-stringified payload", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { key: "value" });
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(fake.fakeProducer.calls.send.length > 0);
      const sendOpts = fake.fakeProducer.calls.send[0][0] as { topic: string; messages: Array<{ value: string }> };
      assert.strictEqual(sendOpts.topic, "MY_TOPIC");
      assert.strictEqual(sendOpts.messages[0].value, JSON.stringify({ key: "value" }));
    });
  });

  describe("subscribe() and unsubscribe()", () => {
    it("subscribe() is a no-op — does not throw", async () => {
      await assert.doesNotReject(() => adapter.subscribe("TOPIC"));
    });

    it("unsubscribe() is a no-op — does not throw", async () => {
      await assert.doesNotReject(() => adapter.unsubscribe("TOPIC"));
    });
  });

  describe("disconnect()", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("stops the consumer", async () => {
      await adapter.disconnect();
      assert.strictEqual(fake.fakeConsumer.calls.stop, 1);
    });

    it("disconnects the consumer", async () => {
      await adapter.disconnect();
      assert.strictEqual(fake.fakeConsumer.calls.disconnect, 1);
    });

    it("disconnects the producer", async () => {
      await adapter.disconnect();
      assert.strictEqual(fake.fakeProducer.calls.disconnect, 1);
    });
  });

  describe("getBacklog()", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("returns an empty map for an empty topics array", async () => {
      const result = await adapter.getBacklog([]);
      assert.ok(result instanceof Map);
      assert.strictEqual(result.size, 0);
      assert.strictEqual(fake.fakeAdmin.calls.connect, 0);
    });

    it("calculates lag as latestOffset minus consumerOffset", async () => {
      fake.fakeAdmin.fetchOffsets = () => Promise.resolve([
        { topic: "MY_TOPIC", partitions: [{ partition: 0, offset: "5" }] },
      ]);
      fake.fakeAdmin.fetchTopicOffsets = () => Promise.resolve([{ partition: 0, offset: "10" }]);

      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.strictEqual(result.get("MY_TOPIC"), 5);
      assert.strictEqual(fake.fakeAdmin.calls.connect, 1);
      assert.strictEqual(fake.fakeAdmin.calls.disconnect, 1);
    });

    it("records 0 lag when consumer is caught up", async () => {
      fake.fakeAdmin.fetchOffsets = () => Promise.resolve([
        { topic: "MY_TOPIC", partitions: [{ partition: 0, offset: "10" }] },
      ]);
      fake.fakeAdmin.fetchTopicOffsets = () => Promise.resolve([{ partition: 0, offset: "10" }]);

      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.strictEqual(result.get("MY_TOPIC"), 0);
    });

    it("returns 0 for a topic not found in fetchOffsets response", async () => {
      fake.fakeAdmin.fetchOffsets = () => Promise.resolve([]);
      fake.fakeAdmin.fetchTopicOffsets = () => Promise.resolve([]);

      const result = await adapter.getBacklog(["UNKNOWN_TOPIC"]);
      assert.strictEqual(result.get("UNKNOWN_TOPIC"), 0);
    });
  });
});
