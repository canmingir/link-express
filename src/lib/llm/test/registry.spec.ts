import { describe, it, beforeEach, afterAll } from "bun:test";
import assert from "assert";

import {
  generate,
  registerAdapter,
  extendAdapter,
  getAdapter,
  hasAdapter,
  adapterNames,
  resetAdapters,
} from "../index";
import type { GenerateParams, LLMAdapter } from "../types";

function recorder(result: Record<string, unknown> = { ok: true }) {
  const calls: GenerateParams[] = [];
  const adapter: LLMAdapter = {
    async generate(params) {
      calls.push(params);
      return result;
    },
  };
  return { adapter, calls };
}

describe("llm adapter registry", () => {
  const ORIGINAL_PLATFORM_LLM = process.env.PLATFORM_LLM;

  beforeEach(() => {
    resetAdapters();
    delete process.env.PLATFORM_LLM;
  });

  afterAll(() => {
    resetAdapters();
    process.env.PLATFORM_LLM = ORIGINAL_PLATFORM_LLM;
  });

  it("ships the built-in adapters", () => {
    assert.deepEqual(adapterNames().sort(), [
      "anthropic",
      "bedrock",
      "local",
      "mock",
      "openai",
      "openrouter",
    ]);
  });

  it("registers a new adapter selectable through PLATFORM_LLM", async () => {
    const { adapter, calls } = recorder({ answer: 42 });
    registerAdapter("Groq", adapter);
    process.env.PLATFORM_LLM = "groq/llama-3.3-70b";

    const result = await generate({ content: "hi", json_format: "{ answer: <A> }" });

    assert.deepEqual(result, { answer: 42 });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].model, "llama-3.3-70b");
    assert.strictEqual(calls[0].responseFormat, "{ answer: <A> }");
  });

  it("accepts a lazy loader returning a module with a default export", async () => {
    const { adapter, calls } = recorder();
    let loaded = 0;
    registerAdapter("lazy", async () => {
      loaded++;
      return { default: adapter };
    });

    assert.strictEqual(loaded, 0);
    await generate({ provider: "lazy", content: "a", json_format: "{}" });
    await generate({ provider: "lazy", content: "b", json_format: "{}" });

    assert.strictEqual(loaded, 1);
    assert.strictEqual(calls.length, 2);
  });

  it("lets a per-call provider override PLATFORM_LLM", async () => {
    const custom = recorder({ from: "custom" });
    registerAdapter("custom", custom.adapter);
    process.env.PLATFORM_LLM = "mock";

    const result = await generate({
      provider: "custom",
      model: "m1",
      content: "x",
      json_format: "{}",
    });

    assert.deepEqual(result, { from: "custom" });
    assert.strictEqual(custom.calls[0].model, "m1");
  });

  it("overrides a built-in adapter when registered under the same name", async () => {
    const { adapter } = recorder({ overridden: true });
    registerAdapter("openai", adapter);

    assert.deepEqual(
      await generate({ provider: "openai", content: "x", json_format: "{}" }),
      { overridden: true },
    );
  });

  it("extends an adapter by wrapping the existing one", async () => {
    const base = recorder({ value: 1 });
    registerAdapter("wrapped", base.adapter);

    extendAdapter("wrapped", (inner) => ({
      async generate(params) {
        const result = await inner.generate({ ...params, temperature: 0.7 });
        return { ...result, extended: true };
      },
    }));

    const result = await generate({ provider: "wrapped", content: "x", json_format: "{}" });

    assert.deepEqual(result, { value: 1, extended: true });
    assert.strictEqual(base.calls[0].temperature, 0.7);
  });

  it("stacks multiple extensions in registration order", async () => {
    const base = recorder({ trail: [] as string[] });
    registerAdapter("stack", base.adapter);

    for (const tag of ["first", "second"]) {
      extendAdapter("stack", (inner) => ({
        async generate(params) {
          const result = await inner.generate(params);
          return { trail: [...(result.trail as string[]), tag] };
        },
      }));
    }

    const result = await generate({ provider: "stack", content: "x", json_format: "{}" });

    assert.deepEqual(result, { trail: ["first", "second"] });
  });

  it("drops the cached adapter when it is re-registered", async () => {
    registerAdapter("swap", recorder({ v: 1 }).adapter);
    assert.deepEqual(
      await generate({ provider: "swap", content: "x", json_format: "{}" }),
      { v: 1 },
    );

    registerAdapter("swap", recorder({ v: 2 }).adapter);
    assert.deepEqual(
      await generate({ provider: "swap", content: "x", json_format: "{}" }),
      { v: 2 },
    );
  });

  it("rejects unknown providers and invalid adapters", async () => {
    process.env.PLATFORM_LLM = "nope/model";

    await assert.rejects(
      generate({ content: "x", json_format: "{}" }),
      /Unknown LLM provider "nope"/,
    );
    assert.throws(() => extendAdapter("nope", (a) => a), /Cannot extend unknown/);
    assert.throws(
      () => registerAdapter("bad", {} as LLMAdapter),
      /must expose a generate/,
    );
    assert.strictEqual(hasAdapter("bad"), false);
  });

  it("retries a loader that failed instead of caching the failure", async () => {
    let attempts = 0;
    registerAdapter("flaky", async () => {
      attempts++;
      if (attempts === 1) throw new Error("boom");
      return recorder({ ok: 1 }).adapter;
    });

    await assert.rejects(getAdapter("flaky"), /boom/);
    assert.deepEqual(
      await generate({ provider: "flaky", content: "x", json_format: "{}" }),
      { ok: 1 },
    );
  });
});
