/**
 * EventManager tests
 *
 * Strategy: test EventManager using the `inMemory` adapter type (SocketAdapter).
 *
 * IMPORTANT: We use `import type` (no runtime code) for EventManager, and load it
 * with require() AFTER poisoning the socket.io-client cache. This is necessary because
 * TypeScript `import` statements are hoisted by tsx/cjs — any top-level import of
 * EventManager would load SocketAdapter before our fake socket can be installed.
 */

import assert from "assert";
import sinon from "sinon";
import type { EventManager as EventManagerType } from "../client/eventManager";

// ── Fake socket factory ───────────────────────────────────────────────────────

type EventHandler = (data: unknown) => void;

function makeFakeSocket() {
  const listeners = new Map<string, EventHandler[]>();
  const s = {
    on: sinon.stub().callsFake((event: string, handler: EventHandler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),
    emit: sinon.stub(),
    disconnect: sinon.stub(),
    _listeners: listeners,
    trigger(event: string, data: unknown) {
      (listeners.get(event) || []).forEach((h) => h(data));
    },
  };
  return s;
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;
let fakeIo: sinon.SinonStub;
let EventManagerClass: new () => EventManagerType;

// ── Module-level setup: poison socket.io-client BEFORE EventManager is loaded ─

// This module-level code runs when the spec file is first required by Mocha.
// At this point no spec file has caused socket.io-client to be loaded yet
// (because we use `import type` for EventManager, not a value import).
// So we can safely poison the cache here.
const socketIoPath = require.resolve("socket.io-client");
fakeIo = sinon.stub();
fakeSocket = makeFakeSocket();
fakeIo.callsFake(() => fakeSocket);

// Ensure socket.io-client is not already cached with the real implementation.
// If it is, replace the exports with our fake.
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

// Now delete SocketAdapter from the cache (if already loaded) so it gets fresh-required
// with the fake io when EventManager is loaded below.
try {
  delete require.cache[require.resolve("../client/adapters/SocketAdapter")];
} catch {
  /* not in cache */
}

// Load EventManager (and its dependencies including SocketAdapter) NOW with the fake io
EventManagerClass = require("../client/eventManager").EventManager;

// ─────────────────────────────────────────────────────────────────────────────

describe("EventManager", () => {
  let manager: EventManagerType;
  let clock: sinon.SinonFakeTimers;

  const inMemoryOpts = {
    type: "inMemory" as const,
    host: "localhost",
    port: 4000,
    protocol: "http",
  };

  beforeEach(async () => {
    fakeSocket = makeFakeSocket();
    fakeIo.reset();
    fakeIo.callsFake(() => fakeSocket);

    clock = sinon.useFakeTimers();
    manager = new EventManagerClass();
    await manager.init(inMemoryOpts);
  });

  afterEach(async () => {
    await manager.disconnect();
    clock.restore();
  });

  // ── init() ──────────────────────────────────────────────────────────────────

  describe("init()", () => {
    it("calls connect() on the adapter — io() is invoked with the correct URL", () => {
      assert.ok(fakeIo.calledOnce, "io() should have been called once");
      const [url] = fakeIo.firstCall.args as [string];
      assert.strictEqual(url, "http://localhost:4000");
    });

    it("registers the onMessage handler — socket has 'event' listener", () => {
      assert.ok(
        fakeSocket.on.calledWith("event"),
        "socket.on('event') should be registered",
      );
    });

    it("re-initialising disconnects the previous adapter before creating a new one", async () => {
      const firstSocket = fakeSocket;

      // Prepare a new socket for the re-init
      fakeSocket = makeFakeSocket();
      fakeIo.reset();
      fakeIo.callsFake(() => fakeSocket);

      await manager.init(inMemoryOpts);

      // The first socket should have been disconnected
      assert.ok(
        firstSocket.disconnect.calledOnce,
        "previous socket should be disconnected",
      );
      // io() should have been called again for the new connection
      assert.ok(fakeIo.calledOnce, "io() should be called again on re-init");
    });

    it("throws for an unknown adapter type", async () => {
      const m = new EventManagerClass();
      await assert.rejects(
        () => m.init({ type: "unknown" as never }),
        /Unknown adapter type/,
      );
    });
  });

  // ── publish() ───────────────────────────────────────────────────────────────

  describe("publish()", () => {
    it("emits 'publish' on the socket with the correct type and payload", async () => {
      await manager.publish("TOPIC", { key: "value" });
      assert.ok(
        fakeSocket.emit.calledWith("publish", {
          type: "TOPIC",
          payload: { key: "value" },
        }),
        "socket.emit should be called with publish event",
      );
    });

    it("joins multiple type parts with underscore", async () => {
      await manager.publish("A", "B", { val: 1 });
      const args = fakeSocket.emit.firstCall.args as [
        string,
        { type: string; payload: object },
      ];
      assert.strictEqual(args[1].type, "A_B");
    });

    it("throws when adapter is not initialized", async () => {
      const m = new EventManagerClass();
      await assert.rejects(
        () => m.publish("TOPIC", {}),
        /Event system not initialized/,
      );
    });

    it("throws for __proto__ as event type", async () => {
      await assert.rejects(
        () => manager.publish("__proto__", {}),
        /Invalid event type/,
      );
    });

    it("throws for constructor as event type", async () => {
      await assert.rejects(
        () => manager.publish("constructor", {}),
        /Invalid event type/,
      );
    });
  });

  // ── subscribe() ─────────────────────────────────────────────────────────────

  describe("subscribe()", () => {
    it("calls adapter.subscribe for the first subscriber", async () => {
      await manager.subscribe("TOPIC", () => {});
      assert.ok(
        fakeSocket.emit.calledWith("subscribe", "TOPIC"),
        "socket.emit('subscribe') should be called for the first subscriber",
      );
    });

    it("does NOT call adapter.subscribe for subsequent subscribers to the same type", async () => {
      await manager.subscribe("TOPIC", () => {});
      fakeSocket.emit.reset();
      await manager.subscribe("TOPIC", () => {});
      const subscribeCalls = (fakeSocket.emit.args as unknown[][]).filter(
        (a) => a[0] === "subscribe",
      );
      assert.strictEqual(subscribeCalls.length, 0);
    });

    it("returns an unsubscribe function", async () => {
      const unsub = await manager.subscribe("TOPIC", () => {});
      assert.strictEqual(typeof unsub, "function");
    });

    it("calls adapter.unsubscribe when the last subscriber unsubscribes", async () => {
      const unsub = await manager.subscribe("TOPIC", () => {});
      fakeSocket.emit.reset();
      await unsub();
      assert.ok(
        fakeSocket.emit.calledWith("unsubscribe", "TOPIC"),
        "socket.emit('unsubscribe') should be called when last subscriber leaves",
      );
    });

    it("does NOT call adapter.unsubscribe when other subscribers remain", async () => {
      const unsub1 = await manager.subscribe("TOPIC", () => {});
      await manager.subscribe("TOPIC", () => {});
      fakeSocket.emit.reset();
      await unsub1();
      const unsubCalls = (fakeSocket.emit.args as unknown[][]).filter(
        (a) => a[0] === "unsubscribe",
      );
      assert.strictEqual(unsubCalls.length, 0);
    });
  });

  // ── message routing ─────────────────────────────────────────────────────────

  describe("message routing", () => {
    it("invokes registered callback when adapter fires a message", async () => {
      const received: object[] = [];
      await manager.subscribe("TOPIC", (p: object) => received.push(p));

      fakeSocket.trigger("event", { type: "TOPIC", payload: { msg: "hello" } });
      clock.tick(10);

      assert.deepStrictEqual(received, [{ msg: "hello" }]);
    });

    it("does not invoke callbacks for a different type", async () => {
      const received: object[] = [];
      await manager.subscribe("OTHER", (p: object) => received.push(p));

      fakeSocket.trigger("event", { type: "TOPIC", payload: { msg: "hello" } });
      clock.tick(10);

      assert.strictEqual(received.length, 0);
    });

    it("swallows callback errors without propagating", async () => {
      await manager.subscribe("TOPIC", () => {
        throw new Error("boom");
      });
      assert.doesNotThrow(() => {
        fakeSocket.trigger("event", { type: "TOPIC", payload: {} });
        clock.tick(10);
      });
    });
  });

  // ── disconnect() ────────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("calls socket.disconnect()", async () => {
      await manager.disconnect();
      assert.ok(
        fakeSocket.disconnect.calledOnce,
        "socket.disconnect() should be called",
      );
    });

    it("clears all registered callbacks after disconnect", async () => {
      const received: object[] = [];
      await manager.subscribe("TOPIC", (p: object) => received.push(p));
      await manager.disconnect();

      fakeSocket.trigger("event", { type: "TOPIC", payload: {} });
      clock.tick(10);

      assert.strictEqual(received.length, 0);
    });
  });
});
