import { strict as assert } from "assert";
import type { EventManager as EventManagerType } from "../client/eventManager";

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
let fakeIoCallCount = 0;
let EventManagerClass: new () => EventManagerType;

const socketIoPath = require.resolve("socket.io-client");
fakeSocket = makeFakeSocket();

require.cache[socketIoPath] = {
  id: socketIoPath, filename: socketIoPath, loaded: true,
  parent: null, children: [], paths: [],
  exports: { io: () => { fakeIoCallCount++; return fakeSocket; } },
} as NodeModule;

try { delete require.cache[require.resolve("../client/adapters/SocketAdapter")]; } catch { /* not in cache */ }

EventManagerClass = require("../client/eventManager").EventManager;

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("EventManager", () => {
  let manager: EventManagerType;

  const inMemoryOpts = { type: "inMemory" as const, host: "localhost", port: 4000, protocol: "http" };

  beforeEach(async () => {
    fakeSocket = makeFakeSocket();
    fakeIoCallCount = 0;
    require.cache[socketIoPath]!.exports = { io: () => { fakeIoCallCount++; return fakeSocket; } };

    manager = new EventManagerClass();
    await manager.init(inMemoryOpts);
  });

  afterEach(async () => {
    await manager.disconnect();
  });

  describe("init()", () => {
    it("calls connect() on the adapter — io() is invoked once", () => {
      assert.strictEqual(fakeIoCallCount, 1);
    });

    it("registers the onMessage handler — socket has 'event' listener", () => {
      const hasEventListener = fakeSocket.calls.on.some(([e]) => e === "event");
      assert.ok(hasEventListener);
    });

    it("re-initialising disconnects the previous adapter before creating a new one", async () => {
      const firstSocket = fakeSocket;
      fakeSocket = makeFakeSocket();
      fakeIoCallCount = 0;
      require.cache[socketIoPath]!.exports = { io: () => { fakeIoCallCount++; return fakeSocket; } };

      await manager.init(inMemoryOpts);

      assert.strictEqual(firstSocket.calls.disconnect, 1);
      assert.strictEqual(fakeIoCallCount, 1);
    });

    it("throws for an unknown adapter type", async () => {
      const m = new EventManagerClass();
      await assert.rejects(
        () => m.init({ type: "unknown" } as never),
        /Unknown adapter type/,
      );
    });
  });

  describe("publish()", () => {
    it("emits 'publish' on the socket with the correct type and payload", async () => {
      await manager.publish("TOPIC", { key: "value" });
      const call = fakeSocket.calls.emit.find(([e]) => e === "publish");
      assert.deepStrictEqual(call, ["publish", { type: "TOPIC", payload: { key: "value" } }]);
    });

    it("joins multiple type parts with underscore", async () => {
      await manager.publish("A", "B", { val: 1 });
      const call = fakeSocket.calls.emit.find(([e]) => e === "publish") as unknown[];
      assert.strictEqual((call[1] as { type: string }).type, "A_B");
    });

    it("throws when adapter is not initialized", async () => {
      const m = new EventManagerClass();
      await assert.rejects(() => m.publish("TOPIC", {}), /Event system not initialized/);
    });

    it("throws for __proto__ as event type", async () => {
      await assert.rejects(() => manager.publish("__proto__", {}), /Invalid event type/);
    });

    it("throws for constructor as event type", async () => {
      await assert.rejects(() => manager.publish("constructor", {}), /Invalid event type/);
    });
  });

  describe("subscribe()", () => {
    it("calls adapter.subscribe for the first subscriber", async () => {
      await manager.subscribe("TOPIC", () => {});
      const call = fakeSocket.calls.emit.find(([e]) => e === "subscribe");
      assert.deepStrictEqual(call, ["subscribe", "TOPIC"]);
    });

    it("does NOT call adapter.subscribe for subsequent subscribers to the same type", async () => {
      await manager.subscribe("TOPIC", () => {});
      const emitCountBefore = fakeSocket.calls.emit.length;
      await manager.subscribe("TOPIC", () => {});
      const newSubscribeCalls = fakeSocket.calls.emit
        .slice(emitCountBefore)
        .filter(([e]) => e === "subscribe");
      assert.strictEqual(newSubscribeCalls.length, 0);
    });

    it("returns an unsubscribe function", async () => {
      const unsub = await manager.subscribe("TOPIC", () => {});
      assert.strictEqual(typeof unsub, "function");
    });

    it("calls adapter.unsubscribe when the last subscriber unsubscribes", async () => {
      const unsub = await manager.subscribe("TOPIC", () => {});
      const emitCountBefore = fakeSocket.calls.emit.length;
      await unsub();
      const call = fakeSocket.calls.emit.slice(emitCountBefore).find(([e]) => e === "unsubscribe");
      assert.deepStrictEqual(call, ["unsubscribe", "TOPIC"]);
    });

    it("does NOT call adapter.unsubscribe when other subscribers remain", async () => {
      const unsub1 = await manager.subscribe("TOPIC", () => {});
      await manager.subscribe("TOPIC", () => {});
      const emitCountBefore = fakeSocket.calls.emit.length;
      await unsub1();
      const unsubCalls = fakeSocket.calls.emit.slice(emitCountBefore).filter(([e]) => e === "unsubscribe");
      assert.strictEqual(unsubCalls.length, 0);
    });
  });

  describe("message routing", () => {
    it("invokes registered callback when adapter fires a message", async () => {
      const received: object[] = [];
      await manager.subscribe("TOPIC", (p: object) => received.push(p));

      fakeSocket.trigger("event", { type: "TOPIC", payload: { msg: "hello" } });
      await tick();

      assert.deepStrictEqual(received, [{ msg: "hello" }]);
    });

    it("does not invoke callbacks for a different type", async () => {
      const received: object[] = [];
      await manager.subscribe("OTHER", (p: object) => received.push(p));

      fakeSocket.trigger("event", { type: "TOPIC", payload: { msg: "hello" } });
      await tick();

      assert.strictEqual(received.length, 0);
    });

    it("swallows callback errors without propagating", async () => {
      await manager.subscribe("TOPIC", () => { throw new Error("boom"); });
      fakeSocket.trigger("event", { type: "TOPIC", payload: {} });
      await tick();
    });
  });

  describe("disconnect()", () => {
    it("calls socket.disconnect()", async () => {
      await manager.disconnect();
      assert.strictEqual(fakeSocket.calls.disconnect, 1);
    });

    it("clears all registered callbacks after disconnect", async () => {
      const received: object[] = [];
      await manager.subscribe("TOPIC", (p: object) => received.push(p));
      await manager.disconnect();

      fakeSocket.trigger("event", { type: "TOPIC", payload: {} });
      await tick();

      assert.strictEqual(received.length, 0);
    });
  });
});
