/**
 * TxEventQAdapter tests
 *
 * oracledb is a native addon — setup.ts pre-poisons its cache before any spec is loaded.
 * Here we replace that placeholder with real sinon stubs before fresh-requiring the adapter.
 *
 * IMPORTANT: The consumeLoop runs as a non-awaited background promise. To prevent an
 * infinite loop spinning (OOM), the default fakeQueue.deqOne never resolves
 * (returns a pending promise). Tests that need message delivery provide their own deqOne stub.
 * Each test calls adapter.disconnect() in afterEach to stop the loop.
 */

import assert from "assert";
import sinon from "sinon";

// ── Fake oracledb ─────────────────────────────────────────────────────────────

function makeFakeQueue(firstMessage?: object) {
  const stub = sinon.stub();
  if (firstMessage !== undefined) {
    // First call returns the message; second call hangs forever
    stub.onFirstCall().resolves(firstMessage);
    stub.onSecondCall().returns(new Promise<never>(() => {}));
  } else {
    // Default: never resolves — prevents the consume loop from spinning
    stub.returns(new Promise<never>(() => {}));
  }

  return {
    enqOne: sinon.stub().resolves(),
    deqOne: stub,
    deqOptions: { wait: 0, consumerName: "" },
  };
}

function makeFakeConnection(queue = makeFakeQueue()) {
  return {
    getQueue: sinon.stub().resolves(queue),
    execute: sinon.stub().resolves({ rows: [{ BACKLOG: 5 }] }),
    commit: sinon.stub().resolves(),
    close: sinon.stub().resolves(),
    _queue: queue,
  };
}

let fakeOracledb: {
  getConnection: sinon.SinonStub;
  initOracleClient: sinon.SinonStub;
  DB_TYPE_JSON: string;
  OUT_FORMAT_OBJECT: number;
  thin: boolean;
};

let TxEventQAdapterClass: typeof import("../client/adapters/TxEventQAdapter").TxEventQAdapter;

before(() => {
  fakeOracledb = {
    getConnection: sinon.stub(),
    initOracleClient: sinon.stub(),
    DB_TYPE_JSON: "JSON",
    OUT_FORMAT_OBJECT: 4008,
    thin: true,
  };

  // Replace the placeholder oracledb cache entry (installed by setup.ts) with stubs
  const oraPath = require.resolve("oracledb");
  require.cache[oraPath]!.exports = fakeOracledb;

  // Fresh-require the adapter so it picks up fakeOracledb
  delete require.cache[require.resolve("../client/adapters/TxEventQAdapter")];
  TxEventQAdapterClass = require("../client/adapters/TxEventQAdapter").TxEventQAdapter;
});

// ─────────────────────────────────────────────────────────────────────────────

const defaultOptions = {
  connectString: "localhost/XE",
  user: "testuser",
  password: "testpass",
};

describe("TxEventQAdapter", () => {
  let fakeConn: ReturnType<typeof makeFakeConnection>;
  let fakeQueue: ReturnType<typeof makeFakeQueue>;
  let adapter: InstanceType<typeof TxEventQAdapterClass>;

  beforeEach(() => {
    fakeOracledb.getConnection.reset();
    fakeOracledb.initOracleClient.reset();
    fakeOracledb.thin = true;

    fakeQueue = makeFakeQueue();
    fakeConn = makeFakeConnection(fakeQueue);
    fakeOracledb.getConnection.resolves(fakeConn);

    adapter = new TxEventQAdapterClass(defaultOptions);
  });

  afterEach(async () => {
    // Always disconnect to stop any running consume loops
    try { await adapter.disconnect(); } catch { /* ignore */ }
  });

  // ── connect() ─────────────────────────────────────────────────────────────

  describe("connect()", () => {
    it("calls oracledb.getConnection with the provided credentials", async () => {
      await adapter.connect();
      assert.ok(fakeOracledb.getConnection.calledOnce);
      const [connOpts] = fakeOracledb.getConnection.firstCall.args as [Record<string, unknown>];
      assert.strictEqual(connOpts.connectString, "localhost/XE");
      assert.strictEqual(connOpts.user, "testuser");
      assert.strictEqual(connOpts.password, "testpass");
    });

    it("does not throw on successful connect", async () => {
      await assert.doesNotReject(() => adapter.connect());
    });

    it("calls initOracleClient when instantClientPath is provided and thin mode is on", async () => {
      fakeOracledb.thin = true;
      const a = new TxEventQAdapterClass({
        ...defaultOptions,
        instantClientPath: "/opt/oracle/lib",
        walletPath: "/opt/oracle/wallet",
      });
      await a.connect();
      assert.ok(fakeOracledb.initOracleClient.calledOnce);
      await a.disconnect();
    });

    it("swallows NJS-509 error from initOracleClient (already initialized)", async () => {
      fakeOracledb.thin = true;
      fakeOracledb.initOracleClient.throws(
        Object.assign(new Error("already init"), { code: "NJS-509" })
      );
      const a = new TxEventQAdapterClass({
        ...defaultOptions,
        instantClientPath: "/opt/oracle/lib",
      });
      await assert.doesNotReject(() => a.connect());
      await a.disconnect();
    });

    it("propagates non-NJS-509 errors from initOracleClient", async () => {
      fakeOracledb.thin = true;
      fakeOracledb.initOracleClient.throws(
        Object.assign(new Error("fatal"), { code: "NJS-999" })
      );
      const a = new TxEventQAdapterClass({
        ...defaultOptions,
        instantClientPath: "/opt/oracle/lib",
      });
      await assert.rejects(() => a.connect(), /fatal/);
    });

    it("does NOT call initOracleClient when thin is false", async () => {
      fakeOracledb.thin = false;
      const a = new TxEventQAdapterClass({
        ...defaultOptions,
        instantClientPath: "/opt/oracle/lib",
      });
      await a.connect();
      assert.ok(fakeOracledb.initOracleClient.notCalled);
      await a.disconnect();
    });
  });

  // ── publish() ─────────────────────────────────────────────────────────────

  describe("publish()", () => {
    it("throws when not connected", async () => {
      await assert.rejects(() => adapter.publish("TOPIC", {}), /not connected/);
    });

    it("calls getQueue with the topic name", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { x: 1 });
      assert.ok(fakeConn.getQueue.calledWith("MY_TOPIC"));
    });

    it("calls enqOne with topic and payload wrapped in message envelope", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { x: 1 });
      assert.ok(fakeQueue.enqOne.called);
      const [msg] = fakeQueue.enqOne.firstCall.args as [{ payload: { topic: string; payload: object } }];
      assert.strictEqual(msg.payload.topic, "MY_TOPIC");
      assert.deepStrictEqual(msg.payload.payload, { x: 1 });
    });

    it("calls commit after enqOne resolves", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", {});
      // enqOne is fire-and-forget (.then) — flush microtasks
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(fakeConn.commit.called, "commit should be called after enqOne");
    });

    it("caches the queue — second publish to same topic does not call getQueue again", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", {});
      await adapter.publish("MY_TOPIC", {});
      assert.strictEqual(fakeConn.getQueue.callCount, 1, "getQueue should only be called once");
    });
  });

  // ── subscribe() ───────────────────────────────────────────────────────────

  describe("subscribe()", () => {
    it("throws when not connected", async () => {
      await assert.rejects(() => adapter.subscribe("TOPIC"), /not initialized/);
    });

    it("opens a dedicated subscription connection", async () => {
      const subConn = makeFakeConnection();
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");

      // getConnection called once for main connect, once for subscription
      assert.ok(fakeOracledb.getConnection.callCount >= 2);
    });

    it("uses the TXEVENTQ_USER.{type} queue name", async () => {
      const subConn = makeFakeConnection();
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");

      assert.ok(
        subConn.getQueue.calledWith("TXEVENTQ_USER.MY_TOPIC"),
        "should use TXEVENTQ_USER.<type> queue name"
      );
    });

    it("sets deqOptions.consumerName from options.consumerName when provided", async () => {
      const subConn = makeFakeConnection();
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      const a = new TxEventQAdapterClass({ ...defaultOptions, consumerName: "my_consumer" });
      await a.connect();
      await a.subscribe("MY_TOPIC");

      assert.strictEqual(subConn._queue.deqOptions.consumerName, "my_consumer");
      await a.disconnect();
    });

    it("derives consumerName from type when not provided in options", async () => {
      const subConn = makeFakeConnection();
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");

      assert.strictEqual(subConn._queue.deqOptions.consumerName, "my_topic_subscriber");
    });
  });

  // ── consumeLoop / onMessage ───────────────────────────────────────────────

  describe("message consumption", () => {
    it("calls onMessage handler when deqOne returns a message", async () => {
      const received: Array<{ type: string; payload: object }> = [];
      adapter.onMessage((type, payload) => received.push({ type, payload }));

      // Oracle dequeue returns { payload: <enqueued-message> }
      // The adapter enqueues { topic, payload }, so deqOne returns { payload: { payload: actualPayload } }
      const msgQueue = makeFakeQueue({ payload: { payload: { hello: "world" } } });
      const subConn = makeFakeConnection(msgQueue);
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");

      // Allow microtasks to process the first deqOne result
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].type, "MY_TOPIC");
      assert.deepStrictEqual(received[0].payload, { hello: "world" });
    });
  });

  // ── disconnect() ──────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("closes all subscription connections", async () => {
      const subConn = makeFakeConnection();
      fakeOracledb.getConnection.onSecondCall().resolves(subConn);

      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");
      await adapter.disconnect();

      assert.ok(subConn.close.calledOnce, "subscription connection should be closed");
    });

    it("closes the main connection", async () => {
      await adapter.connect();
      await adapter.disconnect();
      assert.ok(fakeConn.close.calledOnce, "main connection should be closed");
    });

    it("clears the queue cache — getQueue is called again after reconnect", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", {});
      await adapter.disconnect();

      const newConn = makeFakeConnection();
      fakeOracledb.getConnection.resolves(newConn);
      await adapter.connect();
      await adapter.publish("MY_TOPIC", {});

      assert.ok(newConn.getQueue.called, "getQueue should be called again after reconnect");
    });
  });

  // ── getBacklog() ──────────────────────────────────────────────────────────

  describe("getBacklog()", () => {
    it("returns an empty map when not connected", async () => {
      const result = await adapter.getBacklog(["TOPIC"]);
      assert.ok(result instanceof Map);
      assert.strictEqual(result.size, 0);
    });

    it("executes the backlog SQL and returns the BACKLOG value", async () => {
      fakeConn.execute.resolves({ rows: [{ BACKLOG: 7 }] });
      await adapter.connect();
      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.ok(fakeConn.execute.called);
      assert.strictEqual(result.get("MY_TOPIC"), 7);
    });

    it("returns 0 for a topic when the query returns no rows", async () => {
      fakeConn.execute.resolves({ rows: [] });
      await adapter.connect();
      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.strictEqual(result.get("MY_TOPIC"), 0);
    });

    it("returns 0 for a topic when the SQL query throws", async () => {
      fakeConn.execute.rejects(new Error("ORA-12345"));
      await adapter.connect();
      const result = await adapter.getBacklog(["MY_TOPIC"]);
      assert.strictEqual(result.get("MY_TOPIC"), 0);
    });

    it("handles multiple topics independently", async () => {
      fakeConn.execute
        .onFirstCall().resolves({ rows: [{ BACKLOG: 3 }] })
        .onSecondCall().resolves({ rows: [{ BACKLOG: 8 }] });
      await adapter.connect();
      const result = await adapter.getBacklog(["TOPIC_A", "TOPIC_B"]);
      assert.strictEqual(result.get("TOPIC_A"), 3);
      assert.strictEqual(result.get("TOPIC_B"), 8);
    });
  });
});
