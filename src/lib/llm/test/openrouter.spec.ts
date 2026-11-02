import { describe, it, beforeEach, afterEach, mock } from "bun:test";
import assert from "assert";

const calls: Record<string, unknown>[] = [];

mock.module("openai", () => ({
  __esModule: true,
  default: class {
    chat = {
      completions: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            model: params.model,
            choices: [
              { finish_reason: "stop", message: { content: '{"ok":true}' } },
            ],
          };
        },
      },
    };
  },
}));

describe("openrouter adapter", () => {
  const ORIGINAL_OPENROUTER_PROVIDER = process.env.OPENROUTER_PROVIDER;

  beforeEach(() => {
    calls.length = 0;
    delete process.env.OPENROUTER_PROVIDER;
  });

  afterEach(() => {
    if (ORIGINAL_OPENROUTER_PROVIDER === undefined) {
      delete process.env.OPENROUTER_PROVIDER;
    } else {
      process.env.OPENROUTER_PROVIDER = ORIGINAL_OPENROUTER_PROVIDER;
    }
  });

  it("routes to a single provider from OPENROUTER_PROVIDER", async () => {
    const { default: openrouter } = await import("../openrouter");

    process.env.OPENROUTER_PROVIDER = "azure";
    await openrouter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.deepEqual(calls[0].provider, {
      order: ["azure"],
      allow_fallbacks: false,
    });
  });

  it("keeps the order of comma-separated providers and trims blanks", async () => {
    const { default: openrouter } = await import("../openrouter");

    process.env.OPENROUTER_PROVIDER = " deepinfra/turbo , together,, ";
    await openrouter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.deepEqual(calls[0].provider, {
      order: ["deepinfra/turbo", "together"],
      allow_fallbacks: false,
    });
  });

  it("routes to deepinfra/bf16 when OPENROUTER_PROVIDER is not set", async () => {
    const { default: openrouter } = await import("../openrouter");

    await openrouter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.deepEqual(calls[0].provider, {
      order: ["deepinfra/bf16"],
      allow_fallbacks: false,
    });
  });

  describe("PLATFORM_LLM_REASONING", () => {
    const ORIGINAL_PLATFORM_LLM_REASONING = process.env.PLATFORM_LLM_REASONING;

    beforeEach(() => {
      delete process.env.PLATFORM_LLM_REASONING;
    });

    afterEach(() => {
      if (ORIGINAL_PLATFORM_LLM_REASONING === undefined) {
        delete process.env.PLATFORM_LLM_REASONING;
      } else {
        process.env.PLATFORM_LLM_REASONING = ORIGINAL_PLATFORM_LLM_REASONING;
      }
    });

    async function reasoningFor(value?: string) {
      const { default: openrouter } = await import("../openrouter");

      if (value !== undefined) {
        process.env.PLATFORM_LLM_REASONING = value;
      }
      await openrouter.generate({
        messages: [{ role: "user", content: "hi" }],
      });

      return calls[calls.length - 1];
    }

    it("disables reasoning when not set", async () => {
      const params = await reasoningFor();

      assert.deepEqual(params.reasoning, { enabled: false });
    });

    it("disables reasoning for off", async () => {
      const params = await reasoningFor(" OFF ");

      assert.deepEqual(params.reasoning, { enabled: false });
    });

    it("leaves reasoning to the model for on", async () => {
      const params = await reasoningFor("on");

      assert.equal("reasoning" in params, false);
    });

    it("passes an effort level through", async () => {
      const params = await reasoningFor("low");

      assert.deepEqual(params.reasoning, { effort: "low" });
    });

    it("treats a positive integer as a reasoning token budget", async () => {
      const params = await reasoningFor("2048");

      assert.deepEqual(params.reasoning, { max_tokens: 2048 });
    });

    it("rejects an unknown value", async () => {
      await assert.rejects(
        reasoningFor("fast"),
        /Invalid PLATFORM_LLM_REASONING/
      );
    });
  });
});
