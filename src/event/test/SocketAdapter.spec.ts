/**
 * SocketAdapter tests
 *
 * socket.io-client is mocked via require-cache poisoning before the adapter is loaded.
 * The EventManager spec also poisons socket.io-client — these two specs share the same
 * poisoned cache entry (both use the same fakeIo), which is fine because SocketAdapter
 * is loaded once and cached.
 */

import assert from "assert";
import sinon from "sinon";

// ── Fake socket.io-client ─────────────────────────────────────────────────────

type EventHandler = (data: unknown) => void;

function makeFakeSocket() {
  const listeners = new Map<string, EventHandler[]>();
  return {
    on: sinon.stub().callsFake((event: string, handler: EventHandler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),
    emit: sinon.stub(),
    disconnect: sinon.stub(),
    listeners,
    trigger(event: string, data: unknown) {
      (listeners.get(event) || []).forEach((h) => h(data));
    },
  };
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;
let fakeIo: sinon.SinonStub;

let SocketAdapterClass: typeof import("../client/adapters/SocketAdapter").SocketAdapter;

before(() => {
  // The socket.io-client cache is already poisoned by EventManager.spec.ts
  // (or by this file if loaded first). We update the io stub to use ours.
  fakeSocket = makeFakeSocket();
  fakeIo = sinon.stub().callsFake(() => fakeSocket);

  const socketIoPath = require.resolve("socket.io-client");
  if (!require.cache[socketIoPath]) {
    require.cache[socketIoPath] = {
      id: socketIoPath,
      filename: socketIoPath,
      loaded: true,
      parent: null,
      children: [],
      paths: [],
      exports: { io: fakeIo },
    } as NodeModule;
  } else {
    require.cache[socketIoPath]!.exports = { io: fakeIo };
  }

  // Fresh-require SocketAdapter so it picks up our io stub
  delete require.cache[require.resolve("../client/adapters/SocketAdapter")];
  SocketAdapterClass = require("../client/adapters/SocketAdapter").SocketAdapter;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("SocketAdapter", () => {
  let adapter: InstanceType<typeof SocketAdapterClass>;

  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    fakeIo.reset();
    fakeIo.callsFake(() => fakeSocket);

    adapter = new SocketAdapterClass({
      host: "localhost",
      port: 3001,
      protocol: "http",
    });
  });

  afterEach(async () => {
    try { await adapter.disconnect(); } catch { /* ignore */ }
  });

  // ── connect() ─────────────────────────────────────────────────────────────

  describe("connect()", () => {
    it("calls io() with protocol://host:port when port is provided", async () => {
      await adapter.connect();
      assert.ok(fakeIo.calledOnce);
      assert.strictEqual(fakeIo.firstCall.args[0], "http://localhost:3001");
    });

    it("calls io() with protocol://host when port is omitted", async () => {
      const a = new SocketAdapterClass({ host: "myhost", protocol: "ws" });
      await a.connect();
      assert.strictEqual(fakeIo.firstCall.args[0], "ws://myhost");
    });

    it("registers a listener for the 'event' socket event", async () => {
      await adapter.connect();
      assert.ok(fakeSocket.on.calledWith("event"), "should register 'event' listener");
    });
  });

  // ── message handling ───────────────────────────────────────────────────────

  describe("message handling", () => {
    it("invokes onMessage handler when 'event' fires", async () => {
      const received: Array<{ type: string; payload: object }> = [];
      adapter.onMessage((type, payload) => received.push({ type, payload }));

      await adapter.connect();
      fakeSocket.trigger("event", { type: "TOPIC", payload: { msg: "hi" } });

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].type, "TOPIC");
      assert.deepStrictEqual(received[0].payload, { msg: "hi" });
    });

    it("does not crash when no onMessage handler is registered", async () => {
      await adapter.connect();
      assert.doesNotThrow(() =>
        fakeSocket.trigger("event", { type: "TOPIC", payload: {} })
      );
    });
  });

  // ── publish() ─────────────────────────────────────────────────────────────

  describe("publish()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Socket not connected/);
    });

    it("emits 'publish' on the socket with type and payload", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { val: 1 });
      assert.ok(fakeSocket.emit.calledWith("publish", { type: "MY_TOPIC", payload: { val: 1 } }));
    });
  });

  // ── subscribe() ───────────────────────────────────────────────────────────

  describe("subscribe()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.subscribe("TOPIC"), /Socket not connected/);
    });

    it("emits 'subscribe' with the topic name", async () => {
      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");
      assert.ok(fakeSocket.emit.calledWith("subscribe", "MY_TOPIC"));
    });
  });

  // ── unsubscribe() ─────────────────────────────────────────────────────────

  describe("unsubscribe()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.unsubscribe("TOPIC"), /Socket not connected/);
    });

    it("emits 'unsubscribe' with the topic name", async () => {
      await adapter.connect();
      await adapter.unsubscribe("MY_TOPIC");
      assert.ok(fakeSocket.emit.calledWith("unsubscribe", "MY_TOPIC"));
    });
  });

  // ── disconnect() ──────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("calls socket.disconnect()", async () => {
      await adapter.connect();
      await adapter.disconnect();
      assert.ok(fakeSocket.disconnect.calledOnce);
    });

    it("sets socket to null — subsequent publish throws", async () => {
      await adapter.connect();
      await adapter.disconnect();
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Socket not connected/);
    });
  });
});
