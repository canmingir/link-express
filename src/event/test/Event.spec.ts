import assert from "assert";
import sinon from "sinon";
import * as promClient from "prom-client";

// Helper: fresh require of Event.ts, clearing the module and prom-client registry first
function loadEvent() {
  promClient.register.clear();
  const eventPath = require.resolve("../src/Event");
  delete require.cache[eventPath];
  return require("../src/Event") as {
    subscribe: (...args: any[]) => any;
    publish: (...args: any[]) => void;
    last: (type: string, init?: any) => any;
  };
}

describe("Event (in-memory pub/sub)", () => {
  let clock: sinon.SinonFakeTimers;
  let event: ReturnType<typeof loadEvent>;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    event = loadEvent();
  });

  afterEach(() => {
    clock.restore();
  });

  // ── subscribe() ────────────────────────────────────────────────────────────

  describe("subscribe()", () => {
    it("returns a registry with id, type, callback and unsubscribe", () => {
      const cb = () => {};
      const reg = event.subscribe("MY_EVENT", cb);
      assert.ok(reg.id, "should have id");
      assert.strictEqual(reg.type, "MY_EVENT");
      assert.strictEqual(reg.callback, cb);
      assert.strictEqual(typeof reg.unsubscribe, "function");
    });

    it("throws when called with fewer than 2 arguments", () => {
      assert.throws(() => event.subscribe(() => {}), /subscribe requires at least 2 arguments/);
    });

    it("joins multiple string args into a dot-separated type", () => {
      const cb = () => {};
      const reg = event.subscribe("a", "b", cb);
      assert.strictEqual(reg.type, "a.b");
    });

    it("throws for __proto__ as type", () => {
      assert.throws(() => event.subscribe("__proto__", () => {}), /Invalid subscription type/);
    });

    it("throws for constructor as type", () => {
      assert.throws(() => event.subscribe("constructor", () => {}), /Invalid subscription type/);
    });

    it("throws for prototype as type", () => {
      assert.throws(() => event.subscribe("prototype", () => {}), /Invalid subscription type/);
    });

    it("allows multiple subscribers to the same type", () => {
      const cb1 = () => {};
      const cb2 = () => {};
      const reg1 = event.subscribe("TOPIC", cb1);
      const reg2 = event.subscribe("TOPIC", cb2);
      assert.notStrictEqual(reg1.id, reg2.id);
    });

    it("unsubscribe() removes only the specific subscription", () => {
      const calls: string[] = [];
      const reg1 = event.subscribe("TOPIC", () => calls.push("cb1"));
      event.subscribe("TOPIC", () => calls.push("cb2"));

      reg1.unsubscribe();
      event.publish("TOPIC", {});
      clock.tick(10);

      assert.ok(!calls.includes("cb1"), "cb1 should not be called after unsubscribe");
      assert.ok(calls.includes("cb2"), "cb2 should still be called");
    });
  });

  // ── publish() ──────────────────────────────────────────────────────────────

  describe("publish()", () => {
    it("throws when called with fewer than 2 arguments", () => {
      assert.throws(() => event.publish({}), /publish requires at least 2 arguments/);
    });

    it("throws for __proto__ as type", () => {
      // prototype pollution guard — note: messages.set runs before the check, but the
      // type check still throws afterward
      assert.throws(() => event.publish("__proto__", {}), /Invalid publish type/);
    });

    it("calls all registered callbacks with the payload", () => {
      const calls: object[] = [];
      event.subscribe("EVT", (p: object) => calls.push(p));
      event.publish("EVT", { x: 1 });
      clock.tick(10);
      assert.deepStrictEqual(calls, [{ x: 1 }]);
    });

    it("does NOT call callbacks registered for a different type", () => {
      const calls: object[] = [];
      event.subscribe("OTHER", (p: object) => calls.push(p));
      event.publish("EVT", { x: 1 });
      clock.tick(10);
      assert.strictEqual(calls.length, 0);
    });

    it("swallows errors thrown by a callback and does not propagate", () => {
      event.subscribe("EVT", () => { throw new Error("boom"); });
      assert.doesNotThrow(() => {
        event.publish("EVT", {});
        clock.tick(10);
      });
    });

    it("joins multiple string args into a dot-separated type", () => {
      const calls: object[] = [];
      event.subscribe("a", "b", (p: object) => calls.push(p));
      event.publish("a", "b", { val: 2 });
      clock.tick(10);
      assert.deepStrictEqual(calls, [{ val: 2 }]);
    });

    it("after unsubscribing, callback is not called on publish", () => {
      const calls: object[] = [];
      const reg = event.subscribe("EVT", (p: object) => calls.push(p));
      reg.unsubscribe();
      event.publish("EVT", { x: 1 });
      clock.tick(10);
      assert.strictEqual(calls.length, 0);
    });

    it("calls multiple subscribers on the same type", () => {
      const calls: string[] = [];
      event.subscribe("EVT", () => calls.push("a"));
      event.subscribe("EVT", () => calls.push("b"));
      event.publish("EVT", {});
      clock.tick(10);
      assert.ok(calls.includes("a"));
      assert.ok(calls.includes("b"));
    });
  });

  // ── last() ─────────────────────────────────────────────────────────────────

  describe("last()", () => {
    it("returns undefined when no message has been published for that type", () => {
      assert.strictEqual(event.last("NEVER_PUBLISHED"), undefined);
    });

    it("returns the init value when the type has no prior message", () => {
      assert.strictEqual(event.last("NEVER_PUBLISHED", "default"), "default");
    });

    it("returns the last published payload for a given type", () => {
      event.publish("EVT", { n: 42 });
      assert.deepStrictEqual(event.last("EVT"), { n: 42 });
    });

    it("returns the most recent payload after multiple publishes", () => {
      event.publish("EVT", { n: 1 });
      event.publish("EVT", { n: 2 });
      assert.deepStrictEqual(event.last("EVT"), { n: 2 });
    });
  });
});
