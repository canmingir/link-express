import { strict as assert } from "assert";
import * as promClient from "prom-client";
import type { SubscriptionRegistry } from "../src/Event";

type EventModule = {
  subscribe: (...args: unknown[]) => SubscriptionRegistry;
  publish: (...args: unknown[]) => void;
  last: (type: string, init?: unknown) => unknown;
};

function loadEvent(): EventModule {
  promClient.register.clear();
  const eventPath = require.resolve("../src/Event");
  delete require.cache[eventPath];
  return require("../src/Event") as EventModule;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("Event (in-memory pub/sub)", () => {
  let event: EventModule;

  beforeEach(() => {
    event = loadEvent();
  });

  describe("subscribe()", () => {
    it("returns a registry with id, type, callback and unsubscribe", () => {
      const cb = () => {};
      const reg = event.subscribe("MY_EVENT", cb);
      assert.ok(reg.id);
      assert.strictEqual(reg.type, "MY_EVENT");
      assert.strictEqual(reg.callback, cb);
      assert.strictEqual(typeof reg.unsubscribe, "function");
    });

    it("throws when called with fewer than 2 arguments", () => {
      assert.throws(() => event.subscribe(() => {}), /subscribe requires at least 2 arguments/);
    });

    it("joins multiple string args into a dot-separated type", () => {
      const reg = event.subscribe("a", "b", () => {});
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
      const reg1 = event.subscribe("TOPIC", () => {});
      const reg2 = event.subscribe("TOPIC", () => {});
      assert.notStrictEqual(reg1.id, reg2.id);
    });

    it("unsubscribe() removes only the specific subscription", async () => {
      const calls: string[] = [];
      const reg1 = event.subscribe("TOPIC", () => calls.push("cb1"));
      event.subscribe("TOPIC", () => calls.push("cb2"));

      reg1.unsubscribe();
      event.publish("TOPIC", {});
      await tick();

      assert.ok(!calls.includes("cb1"));
      assert.ok(calls.includes("cb2"));
    });
  });

  describe("publish()", () => {
    it("throws when called with fewer than 2 arguments", () => {
      assert.throws(() => event.publish({}), /publish requires at least 2 arguments/);
    });

    it("throws for __proto__ as type", () => {
      assert.throws(() => event.publish("__proto__", {}), /Invalid publish type/);
    });

    it("calls all registered callbacks with the payload", async () => {
      const calls: object[] = [];
      event.subscribe("EVT", (p: object) => calls.push(p));
      event.publish("EVT", { x: 1 });
      await tick();
      assert.deepStrictEqual(calls, [{ x: 1 }]);
    });

    it("does NOT call callbacks registered for a different type", async () => {
      const calls: object[] = [];
      event.subscribe("OTHER", (p: object) => calls.push(p));
      event.publish("EVT", { x: 1 });
      await tick();
      assert.strictEqual(calls.length, 0);
    });

    it("swallows errors thrown by a callback and does not propagate", async () => {
      event.subscribe("EVT", () => { throw new Error("boom"); });
      event.publish("EVT", {});
      await tick();
    });

    it("joins multiple string args into a dot-separated type", async () => {
      const calls: object[] = [];
      event.subscribe("a", "b", (p: object) => calls.push(p));
      event.publish("a", "b", { val: 2 });
      await tick();
      assert.deepStrictEqual(calls, [{ val: 2 }]);
    });

    it("after unsubscribing, callback is not called on publish", async () => {
      const calls: object[] = [];
      const reg = event.subscribe("EVT", (p: object) => calls.push(p));
      reg.unsubscribe();
      event.publish("EVT", { x: 1 });
      await tick();
      assert.strictEqual(calls.length, 0);
    });

    it("calls multiple subscribers on the same type", async () => {
      const calls: string[] = [];
      event.subscribe("EVT", () => calls.push("a"));
      event.subscribe("EVT", () => calls.push("b"));
      event.publish("EVT", {});
      await tick();
      assert.ok(calls.includes("a"));
      assert.ok(calls.includes("b"));
    });
  });

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
