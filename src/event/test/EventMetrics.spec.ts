import assert from "assert";
import sinon from "sinon";
import { EventMetrics } from "../client/metrics";

describe("EventMetrics", () => {
  let metrics: EventMetrics;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // EventMetrics creates its own isolated Registry per instance — no global registry conflicts
    metrics = new EventMetrics();
  });

  // ── recordPublish() ────────────────────────────────────────────────────────

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

  // ── recordPublishError() ───────────────────────────────────────────────────

  describe("recordPublishError()", () => {
    it("does not throw when called with type and error type", () => {
      assert.doesNotThrow(() =>
        metrics.recordPublishError("MY_TOPIC", "publish_error")
      );
    });
  });

  // ── recordCallback() ───────────────────────────────────────────────────────

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

  // ── updateSubscriptions() ─────────────────────────────────────────────────

  describe("updateSubscriptions()", () => {
    it("does not throw when setting subscription count to a positive number", () => {
      assert.doesNotThrow(() => metrics.updateSubscriptions("MY_TOPIC", 3));
    });

    it("does not throw when setting subscription count to zero", () => {
      assert.doesNotThrow(() => metrics.updateSubscriptions("MY_TOPIC", 0));
    });
  });

  // ── updateEventBacklog() ──────────────────────────────────────────────────

  describe("updateEventBacklog()", () => {
    it("does not throw when updating backlog", () => {
      assert.doesNotThrow(() => metrics.updateEventBacklog("MY_TOPIC", 42));
    });
  });

  // ── startPushgateway() / stopPushgateway() ────────────────────────────────

  describe("startPushgateway()", () => {
    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      metrics.stopPushgateway();
      clock.restore();
    });

    it("stores default config when called with no arguments", () => {
      metrics.startPushgateway();
      const config = metrics.getPushgatewayConfig();
      assert.strictEqual(config?.url, "http://localhost:9091");
      assert.strictEqual(config?.jobName, "node_events");
      assert.strictEqual(config?.interval, 15000);
    });

    it("stores provided config values", () => {
      metrics.startPushgateway({
        url: "http://gateway:9999",
        jobName: "my_job",
        interval: 30000,
      });
      const config = metrics.getPushgatewayConfig();
      assert.strictEqual(config?.url, "http://gateway:9999");
      assert.strictEqual(config?.jobName, "my_job");
      assert.strictEqual(config?.interval, 30000);
    });

    it("stopPushgateway() clears the interval", () => {
      const clearIntervalSpy = sinon.spy(global, "clearInterval");
      metrics.startPushgateway({ interval: 1000 });
      metrics.stopPushgateway();
      assert.ok(clearIntervalSpy.called, "clearInterval should have been called");
    });

    it("calling startPushgateway twice replaces the previous interval", () => {
      const clearIntervalSpy = sinon.spy(global, "clearInterval");
      metrics.startPushgateway({ interval: 1000 });
      metrics.startPushgateway({ interval: 2000 });
      // stopPushgateway is called internally on second startPushgateway
      assert.ok(clearIntervalSpy.called);
    });
  });

  // ── pushMetricsToGateway() ────────────────────────────────────────────────

  describe("pushMetricsToGateway()", () => {
    it("throws when pushgateway is not configured", async () => {
      await assert.rejects(
        () => metrics.pushMetricsToGateway(),
        /Pushgateway not configured/
      );
    });

    it("calls fetch with the correct pushgateway URL when configured", async () => {
      const fetchStub = sinon.stub(global, "fetch").resolves({
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response);

      metrics.startPushgateway({
        url: "http://pushgateway:9091",
        jobName: "test_job",
        instance: "test_instance",
        interval: 60000,
      });

      await metrics.pushMetricsToGateway();

      assert.ok(fetchStub.calledOnce, "fetch should be called once");
      const [url] = fetchStub.firstCall.args as [string, ...unknown[]];
      assert.ok(
        url.includes("http://pushgateway:9091"),
        "URL should include pushgateway host"
      );
      assert.ok(url.includes("test_job"), "URL should include job name");
      assert.ok(url.includes("test_instance"), "URL should include instance");

      metrics.stopPushgateway();
    });

    it("does not throw when fetch fails (error is caught internally)", async () => {
      sinon.stub(global, "fetch").rejects(new Error("network error"));

      metrics.startPushgateway({ url: "http://pushgateway:9091" });

      await assert.doesNotReject(() => metrics.pushMetricsToGateway());

      metrics.stopPushgateway();
    });
  });
});
