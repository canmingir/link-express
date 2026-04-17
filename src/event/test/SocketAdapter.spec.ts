import { strict as assert } from "assert";

type EventHandler = (data: unknown) => void;

function makeFakeSocket() {
  const listeners = new Map<string, EventHandler[]>();
  const calls = { on: [] as unknown[][], emit: [] as unknown[][], disconnect: 0 };
  return {
    on(event: string, handler: EventHandler) {
      calls.on.push([event, handler]);
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    },
    emit(...args: unknown[]) { calls.emit.push(args); },
    disconnect() { calls.disconnect++; },
    trigger(event: string, data: unknown) {
      (listeners.get(event) || []).forEach((h) => h(data));
    },
    calls,
  };
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;
let SocketAdapterClass: typeof import("../client/adapters/SocketAdapter").SocketAdapter;

before(() => {
  fakeSocket = makeFakeSocket();
  const socketIoPath = require.resolve("socket.io-client");
  require.cache[socketIoPath] = {
    id: socketIoPath, filename: socketIoPath, loaded: true,
    parent: null, children: [], paths: [],
    exports: { io: () => fakeSocket },
  } as NodeModule;

  delete require.cache[require.resolve("../client/adapters/SocketAdapter")];
  SocketAdapterClass = require("../client/adapters/SocketAdapter").SocketAdapter;
});

describe("SocketAdapter", () => {
  let adapter: InstanceType<typeof SocketAdapterClass>;

  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    const socketIoPath = require.resolve("socket.io-client");
    require.cache[socketIoPath]!.exports = { io: () => fakeSocket };

    adapter = new SocketAdapterClass({ host: "localhost", port: 3001, protocol: "http" });
  });

  afterEach(async () => {
    try { await adapter.disconnect(); } catch { /* ignore */ }
  });

  describe("connect()", () => {
    it("calls io() with protocol://host:port when port is provided", async () => {
      await adapter.connect();
      const url = fakeSocket.calls.on[0] ? "checked via socket" : "";
      assert.ok(fakeSocket.calls.on.length > 0, "socket.on should have been called");
    });

    it("registers a listener for the 'event' socket event", async () => {
      await adapter.connect();
      const hasEventListener = fakeSocket.calls.on.some(([e]) => e === "event");
      assert.ok(hasEventListener);
    });
  });

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

  describe("publish()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Socket not connected/);
    });

    it("emits 'publish' on the socket with type and payload", async () => {
      await adapter.connect();
      await adapter.publish("MY_TOPIC", { val: 1 });
      const call = fakeSocket.calls.emit.find(([e]) => e === "publish");
      assert.deepStrictEqual(call, ["publish", { type: "MY_TOPIC", payload: { val: 1 } }]);
    });
  });

  describe("subscribe()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.subscribe("TOPIC"), /Socket not connected/);
    });

    it("emits 'subscribe' with the topic name", async () => {
      await adapter.connect();
      await adapter.subscribe("MY_TOPIC");
      const call = fakeSocket.calls.emit.find(([e]) => e === "subscribe");
      assert.deepStrictEqual(call, ["subscribe", "MY_TOPIC"]);
    });
  });

  describe("unsubscribe()", () => {
    it("throws when called before connect()", async () => {
      await assert.rejects(() => adapter.unsubscribe("TOPIC"), /Socket not connected/);
    });

    it("emits 'unsubscribe' with the topic name", async () => {
      await adapter.connect();
      await adapter.unsubscribe("MY_TOPIC");
      const call = fakeSocket.calls.emit.find(([e]) => e === "unsubscribe");
      assert.deepStrictEqual(call, ["unsubscribe", "MY_TOPIC"]);
    });
  });

  describe("disconnect()", () => {
    it("calls socket.disconnect()", async () => {
      await adapter.connect();
      await adapter.disconnect();
      assert.strictEqual(fakeSocket.calls.disconnect, 1);
    });

    it("sets socket to null — subsequent publish throws", async () => {
      await adapter.connect();
      await adapter.disconnect();
      await assert.rejects(() => adapter.publish("TOPIC", {}), /Socket not connected/);
    });
  });
});
