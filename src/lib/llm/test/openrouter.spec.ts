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
});
