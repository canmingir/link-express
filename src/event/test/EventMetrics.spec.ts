import { strict as assert } from "assert";
import { EventMetrics } from "../client/metrics";

describe("EventMetrics", () => {
  let metrics: EventMetrics;

  beforeEach(() => {
    metrics = new EventMetrics();
  });

  describe("recordPublish()", () => {
    it("returns a timer function", () => {
      const endTimer = metrics.recordPublish("MY_TOPIC", 128);
      assert.strictEqual(typeof endTimer, "function");
    });

    it("timer function is callable without error", () => {
      const endTimer = metrics.recordPublish("MY_TOPIC", 128);
      assert.doesNotThrow(() => endTimer());
    });
  });

  describe("recordPublishError()", () => {
    it("does not throw when called with type and error type", () => {
      assert.doesNotThrow(() => metrics.recordPublishError("MY_TOPIC", "publish_error"));
    });
  });

  describe("recordCallback()", () => {
    it("returns a timer function", () => {
      const endTimer = metrics.recordCallback("MY_TOPIC");
      assert.strictEqual(typeof endTimer, "function");
    });

    it("timer function is callable without error", () => {
      const endTimer = metrics.recordCallback("MY_TOPIC");
      assert.doesNotThrow(() => endTimer());
    });
  });

  describe("updateSubscriptions()", () => {
    it("does not throw when setting subscription count to a positive number", () => {
      assert.doesNotThrow(() => metrics.updateSubscriptions("MY_TOPIC", 3));
    });

    it("does not throw when setting subscription count to zero", () => {
      assert.doesNotThrow(() => metrics.updateSubscriptions("MY_TOPIC", 0));
    });
  });

  describe("updateEventBacklog()", () => {
    it("does not throw when updating backlog", () => {
      assert.doesNotThrow(() => metrics.updateEventBacklog("MY_TOPIC", 42));
    });
  });

  describe("startPushgateway()", () => {
    afterEach(() => {
      metrics.stopPushgateway();
    });

    it("stores default config when called with no arguments", () => {
      metrics.startPushgateway();
      const config = metrics.getPushgatewayConfig();
      assert.strictEqual(config?.url, "http://localhost:9091");
      assert.strictEqual(config?.jobName, "node_events");
      assert.strictEqual(config?.interval, 15000);
    });

    it("stores provided config values", () => {
      metrics.startPushgateway({ url: "http://gateway:9999", jobName: "my_job", interval: 30000 });
      const config = metrics.getPushgatewayConfig();
      assert.strictEqual(config?.url, "http://gateway:9999");
      assert.strictEqual(config?.jobName, "my_job");
      assert.strictEqual(config?.interval, 30000);
    });

    it("stopPushgateway() clears the interval", () => {
      const cleared: unknown[] = [];
      const original = global.clearInterval;
      global.clearInterval = (...args) => { cleared.push(args[0]); original(...args); };

      metrics.startPushgateway({ interval: 60000 });
      metrics.stopPushgateway();

      global.clearInterval = original;
      assert.ok(cleared.length > 0);
    });

    it("calling startPushgateway twice replaces the previous interval", () => {
      const cleared: unknown[] = [];
      const original = global.clearInterval;
      global.clearInterval = (...args) => { cleared.push(args[0]); original(...args); };

      metrics.startPushgateway({ interval: 60000 });
      metrics.startPushgateway({ interval: 60000 });

      global.clearInterval = original;
      assert.ok(cleared.length > 0);
    });
  });

  describe("pushMetricsToGateway()", () => {
    it("throws when pushgateway is not configured", async () => {
      await assert.rejects(() => metrics.pushMetricsToGateway(), /Pushgateway not configured/);
    });

    it("calls fetch with the correct pushgateway URL when configured", async () => {
      const calls: string[] = [];
      const originalFetch = global.fetch;
      global.fetch = ((url: string) => {
        calls.push(url);
        return Promise.resolve({ ok: true, status: 200, statusText: "OK" } as Response);
      }) as typeof fetch;

      metrics.startPushgateway({ url: "http://pushgateway:9091", jobName: "test_job", instance: "test_instance", interval: 60000 });
      await metrics.pushMetricsToGateway();
      metrics.stopPushgateway();
      global.fetch = originalFetch;

      assert.strictEqual(calls.length, 1);
      assert.ok(calls[0].includes("http://pushgateway:9091"));
      assert.ok(calls[0].includes("test_job"));
      assert.ok(calls[0].includes("test_instance"));
    });

    it("does not throw when fetch fails (error is caught internally)", async () => {
      const originalFetch = global.fetch;
      global.fetch = (() => Promise.reject(new Error("network error"))) as typeof fetch;

      metrics.startPushgateway({ url: "http://pushgateway:9091" });
      await assert.doesNotReject(() => metrics.pushMetricsToGateway());
      metrics.stopPushgateway();
      global.fetch = originalFetch;
    });
  });
});
