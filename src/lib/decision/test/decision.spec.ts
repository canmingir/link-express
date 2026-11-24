import { describe, it, beforeEach, afterEach, mock } from "bun:test";
import assert from "assert";

import type { DecisionParams } from "../types";
import type { LLMLogEntry } from "../../llm/types";

const typesafeAsk = mock((_params: DecisionParams<never>) =>
  Promise.resolve({ pick: "typesafe" }),
);
const layaAsk = mock((_params: DecisionParams<never>) =>
  Promise.resolve({ pick: "laya" }),
);

mock.module("../typesafe", () => ({
  __esModule: true,
  default: { ask: typesafeAsk },
}));

mock.module("../laya", () => ({
  __esModule: true,
  default: { ask: layaAsk },
}));

const questions = { pick: { prompt: "which?", answer: "`x`" } } as never;

describe("decision.ask", () => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    typesafeAsk.mockClear();
    layaAsk.mockClear();
    delete process.env.PLATFORM_DECISION;
    delete process.env.PLATFORM_ROUTER_URL;
    delete process.env.PLATFORM_ROUTER_TOKEN;
  });

  afterEach(async () => {
    process.env = { ...env };
    globalThis.fetch = originalFetch;
    (await import("../../llm")).setLogger(null);
  });

  it("uses typesafe when PLATFORM_DECISION is not set", async () => {
    const { ask } = await import("../index");

    const answers = await ask({ state: {}, questions });

    assert.deepStrictEqual(answers, { pick: "typesafe" });
    assert.strictEqual(typesafeAsk.mock.calls.length, 1);
    assert.strictEqual(typesafeAsk.mock.calls[0][0].provider, "typesafe");
  });

  it("reads provider and model from PLATFORM_DECISION at call time", async () => {
    const { ask } = await import("../index");
    process.env.PLATFORM_DECISION = "LAYA/some-model";

    await ask({ state: {}, questions });

    assert.strictEqual(layaAsk.mock.calls.length, 1);
    assert.strictEqual(layaAsk.mock.calls[0][0].provider, "laya");
    assert.strictEqual(layaAsk.mock.calls[0][0].model, "some-model");
  });

  it("rejects an unknown provider", async () => {
    const { ask } = await import("../index");
    process.env.PLATFORM_DECISION = "nope";

    await assert.rejects(
      () => ask({ state: {}, questions }),
      /Unknown decision provider "nope"/,
    );
  });

  it("sends questions that carry a dataset reference to the router", async () => {
    const { ask } = await import("../index");
    const { setLogger } = await import("../../llm");
    const logs: LLMLogEntry[] = [];
    setLogger((entry) => logs.push(entry));

    process.env.PLATFORM_ROUTER_URL = "https://router.test/";
    process.env.PLATFORM_ROUTER_TOKEN = "secret";

    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({ answers: { pick: "router" }, model: "m" }),
        { status: 200 },
      );
    }) as typeof fetch;

    const answers = await ask({
      state: {},
      questions: {
        pick: {
          prompt: "which?",
          few_shots: { $dataset: "decision-example" },
        },
      } as never,
      meta: { source: "test" },
    });

    assert.deepStrictEqual(answers, { pick: "router" });
    assert.strictEqual(typesafeAsk.mock.calls.length, 0);
    assert.strictEqual(calls[0].url, "https://router.test/decide");
    assert.strictEqual(
      (calls[0].init?.headers as Record<string, string>).Authorization,
      "Bearer secret",
    );
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].provider, "router");
    assert.strictEqual(logs[0].meta?.source, "test");
  });

  it("retries the router after a rate limit and then succeeds", async () => {
    const { ask } = await import("../index");

    process.env.PLATFORM_ROUTER_URL = "https://router.test";
    process.env.PLATFORM_ROUTER_TOKEN = "secret";

    const statuses = [429, 502, 200];
    let calls = 0;
    globalThis.fetch = (async () => {
      const status = statuses[calls++];
      return status === 200
        ? new Response(JSON.stringify({ answers: { pick: "router" } }), {
            status,
          })
        : new Response(JSON.stringify({ error: "busy" }), {
            status,
            headers: { "Retry-After": "0" },
          });
    }) as unknown as typeof fetch;

    const answers = await ask({
      state: {},
      questions: {
        pick: { few_shots: { $dataset: "decision-example" } },
      } as never,
    });

    assert.deepStrictEqual(answers, { pick: "router" });
    assert.strictEqual(calls, 3);
  });

  it("gives up after three rate limited attempts", async () => {
    const { ask } = await import("../index");

    process.env.PLATFORM_ROUTER_URL = "https://router.test";
    process.env.PLATFORM_ROUTER_TOKEN = "secret";

    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(
        JSON.stringify({ error: "Upstream rate limit exceeded" }),
        { status: 429, headers: { "Retry-After": "0" } },
      );
    }) as unknown as typeof fetch;

    await assert.rejects(
      () =>
        ask({
          state: {},
          questions: {
            pick: { few_shots: { $dataset: "decision-example" } },
          } as never,
        }),
      /router request failed \(429\): Upstream rate limit exceeded/,
    );
    assert.strictEqual(calls, 3);
  });

  it("does not retry a client error", async () => {
    const { ask } = await import("../index");

    process.env.PLATFORM_ROUTER_URL = "https://router.test";
    process.env.PLATFORM_ROUTER_TOKEN = "secret";

    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: "bad" }), { status: 400 });
    }) as unknown as typeof fetch;

    await assert.rejects(
      () =>
        ask({
          state: {},
          questions: {
            pick: { few_shots: { $dataset: "decision-example" } },
          } as never,
        }),
      /router request failed \(400\)/,
    );
    assert.strictEqual(calls, 1);
  });

  it("fails clearly when a dataset reference is used without a router", async () => {
    const { ask } = await import("../index");

    await assert.rejects(
      () =>
        ask({
          state: {},
          questions: { pick: { few_shots: { $dataset: "x" } } } as never,
        }),
      /PLATFORM_ROUTER_URL/,
    );
  });
});
