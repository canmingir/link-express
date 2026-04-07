/**
 * KafkaAdapter tests
 *
 * kafkajs is pure JavaScript but we mock it to prevent real broker connections.
 * The kafkajs cache is poisoned before KafkaAdapter is loaded.
 */

import assert from "assert";
import sinon from "sinon";

type EachMessageHandler = (ctx: {
  topic: string;
  message: { value: Buffer | null };
}) => Promise<void>;

let KafkaAdapterClass: typeof import("../client/adapters/KafkaAdapter").KafkaAdapter;
let FakeKafkaConstructor: sinon.SinonStub;

before(() => {
  // Create a stable Kafka constructor stub; the individual instance methods
  // will be set fresh in each beforeEach.
  FakeKafkaConstructor = sinon.stub();

  const kafkaPath = require.resolve("kafkajs");
  require.cache[kafkaPath] = {
    id: kafkaPath,
    filename: kafkaPath,
    loaded: true,
    parent: null,
    children: [],
    paths: [],
    exports: { Kafka: FakeKafkaConstructor },
  } as NodeModule;

  delete require.cache[require.resolve("../client/adapters/KafkaAdapter")];
  KafkaAdapterClass = require("../client/adapters/KafkaAdapter").KafkaAdapter;
});

// ─────────────────────────────────────────────────────────────────────────────

const defaultOptions = {
  clientId: "test-client",
  brokers: ["localhost:9092"],
  groupId: "test-group",
  topics: ["TOPIC_A", "TOPIC_B"],
};

describe("KafkaAdapter", () => {
  let adapter: InstanceType<typeof KafkaAdapterClass>;

  // Fresh stubs created per test so reset() is never needed
  let fakeProducer: {
    connect: sinon.SinonStub;
    disconnect: sinon.SinonStub;
    send: sinon.SinonStub;
  };
  let fakeConsumer: {
    connect: sinon.SinonStub;
    disconnect: sinon.SinonStub;
    subscribe: sinon.SinonStub;
    run: sinon.SinonStub;
    stop: sinon.SinonStub;
    _runHandler?: EachMessageHandler;
  };
  let fakeAdmin: {
    connect: sinon.SinonStub;
    disconnect: sinon.SinonStub;
    fetchOffsets: sinon.SinonStub;
    fetchTopicOffsets: sinon.SinonStub;
  };

  beforeEach(() => {
    fakeProducer = {
      connect: sinon.stub().resolves(),
      disconnect: sinon.stub().resolves(),
      send: sinon.stub().resolves(),
    };

    fakeConsumer = {
      connect: sinon.stub().resolves(),
      disconnect: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(),
      run: sinon.stub().callsFake(async ({ eachMessage }: { eachMessage: EachMessageHandler }) => {
        fakeConsumer._runHandler = eachMessage;
      }),
      stop: sinon.stub().resolves(),
    };

    fakeAdmin = {
      connect: sinon.stub().resolves(),
      disconnect: sinon.stub().resolves(),
      fetchOffsets: sinon.stub().resolves([]),
      fetchTopicOffsets: sinon.stub().resolves([]),
    };

    const fakeKafkaInstance = {
      producer: sinon.stub().returns(fakeProducer),
      consumer: sinon.stub().returns(fakeConsumer),
      admin: sinon.stub().returns(fakeAdmin),
    };

    FakeKafkaConstructor.reset();
    FakeKafkaConstructor.returns(fakeKafkaInstance);

    adapter = new KafkaAdapterClass(defaultOptions);
  });

  afterEach(async () => {
    try { await adapter.disconnect(); } catch { /* ignore */ }
  });

  // ── connect() ─────────────────────────────────────────────────────────────

  describe("connect()", () => {
    it("creates a Kafka instance with the provided clientId and brokers", async () => {
      await adapter.connect();
      assert.ok(FakeKafkaConstructor.called);
      const [opts] = FakeKafkaConstructor.lastCall.args as [{ clientId: string; brokers: string[] }];
      assert.strictEqual(opts.clientId, "test-client");
      assert.deepStrictEqual(opts.brokers, ["localhost:9092"]);
    });

    it("connects the producer", async () => {
      await adapter.connect();
      assert.ok(fakeProducer.connect.calledOnce);
    });

    it("connects the consumer", async () => {
      await adapter.connect();
      assert.ok(fakeConsumer.connect.calledOnce);
    });

    it("subscribes to all non-internal topics via regex", async () => {
      await adapter.connect();
      assert.ok(fakeConsumer.subscribe.calledOnce);
      const [subOpts] = fakeConsumer.subscribe.firstCall.args as [{ topics: RegExp[] }];
      assert.ok(Array.isArray(subOpts.topics));
      const regex = subOpts.topics[0];
      assert.ok(regex instanceof RegExp);
      assert.ok(regex.test("MY_TOPIC"), "should match regular topics");
      assert.ok(!regex.test("__consumer_offsets"), "should NOT match internal kafka topics");
    });

    it("runs the consumer with 1 concurrent partition by default", async () => {
      await adapter.connect();
      assert.ok(fakeConsumer.run.calledOnce);
      const [runOpts] = fakeConsumer.run.firstCall.args as [{ partitionsConsumedConcurrently: number }];
      assert.strictEqual(runOpts.partitionsConsumedConcurrently, 1);
    });

    it("uses provided partitionsConsumedConcurrently when configured", async () => {
      adapter = new KafkaAdapterClass({
        ...defaultOptions,
        partitionsConsumedConcurrently: 4,
      });

      await adapter.connect();
      assert.ok(fakeConsumer.run.calledOnce);
      const [runOpts] = fakeConsumer.run.firstCall.args as [{ partitionsConsumedConcurrently: number }];
      assert.strictEqual(runOpts.partitionsConsumedConcurrently, 4);
    });
  });

  // ── message handling ───────────────────────────────────────────────────────

  describe("message handling (eachMessage)", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("calls onMessage handler with parsed JSON payload for a regular topic", async () => {
      const received: Array<{ type: string; payload: object }> = [];
      adapter.onMessage((type, payload) => received.push({ type, payload }));

      await fakeConsumer._runHandler!({
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

      await fakeConsumer._runHandler!({
        topic: "__consumer_offsets",
        message: { value: Buffer.from("{}") },
      });

      assert.strictEqual(received.length, 0);
    });

    it("does not crash when message.value is invalid JSON", async () => {
      const received: unknown[] = [];
      adapter.onMessage(() => received.push(true));

      await assert.doesNotReject(() =>
        fakeConsumer._runHandler!({
          topic: "MY_TOPIC",
          message: { value: Buffer.from("not-json") },
        })
      );
      assert.strictEqual(received.length, 0);
    });

    it("does not crash when message.value is null", async () => {
      await assert.doesNotReject(() =>
        fakeConsumer._runHandler!({
          topic: "MY_TOPIC",
          message: { value: null },
        })
      );
    });
  });

  // ── publish() ─────────────────────────────────────────────────────────────

  describe("publish()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Producer not connected/);
    });

    it("calls producer.send with the correct topic and JSON-stringified payload", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { key: "value" });
      // send is fire-and-forget via .then — wait for microtasks to settle
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(fakeProducer.send.called);
      const [sendOpts] = fakeProducer.send.firstCall.args as [
        { topic: string; messages: Array<{ value: string }> }
      ];
      assert.strictEqual(sendOpts.topic, "MY_TOPIC");
      assert.strictEqual(sendOpts.messages[0].value, JSON.stringify({ key: "value" }));
    });
  });

  // ── subscribe() / unsubscribe() ───────────────────────────────────────────

  describe("subscribe() and unsubscribe()", () => {
    it("subscribe() is a no-op — does not emit or throw", async () => {
      await assert.doesNotReject(() => adapter.subscribe("TOPIC"));
    });

    it("unsubscribe() is a no-op — does not emit or throw", async () => {
      await assert.doesNotReject(() => adapter.unsubscribe("TOPIC"));
    });
  });

  // ── disconnect() ──────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("stops the consumer", async () => {
      await adapter.disconnect();
      assert.ok(fakeConsumer.stop.calledOnce);
    });

    it("disconnects the consumer", async () => {
      await adapter.disconnect();
      assert.ok(fakeConsumer.disconnect.calledOnce);
    });

    it("disconnects the producer", async () => {
      await adapter.disconnect();
      assert.ok(fakeProducer.disconnect.calledOnce);
    });
  });

  // ── getBacklog() ──────────────────────────────────────────────────────────

  describe("getBacklog()", () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it("returns an empty map for an empty topics array", async () => {
      const result = await adapter.getBacklog([]);
      assert.ok(result instanceof Map);
      assert.strictEqual(result.size, 0);
      assert.ok(fakeAdmin.connect.notCalled);
    });

    it("calculates lag as latestOffset minus consumerOffset", async () => {
      fakeAdmin.fetchOffsets.resolves([
        { topic: "MY_TOPIC", partitions: [{ partition: 0, offset: "5" }] },
      ]);
      fakeAdmin.fetchTopicOffsets.resolves([{ partition: 0, offset: "10" }]);

      const result = await adapter.getBacklog(["MY_TOPIC"]);
      // lag = 10 - 5 = 5
      assert.strictEqual(result.get("MY_TOPIC"), 5);
      assert.ok(fakeAdmin.connect.calledOnce);
      assert.ok(fakeAdmin.disconnect.calledOnce);
    });

    it("records 0 lag when consumer is caught up", async () => {
      fakeAdmin.fetchOffsets.resolves([
        { topic: "MY_TOPIC", partitions: [{ partition: 0, offset: "10" }] },
      ]);
      fakeAdmin.fetchTopicOffsets.resolves([{ partition: 0, offset: "10" }]);

      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.strictEqual(result.get("MY_TOPIC"), 0);
    });

    it("returns 0 for a topic not found in fetchOffsets response", async () => {
      fakeAdmin.fetchOffsets.resolves([]);
      fakeAdmin.fetchTopicOffsets.resolves([]);

      const result = await adapter.getBacklog(["UNKNOWN_TOPIC"]);
      assert.strictEqual(result.get("UNKNOWN_TOPIC"), 0);
    });
  });
});
