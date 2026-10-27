import { describe, it } from "bun:test";
import assert from "assert";
import type OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "../openaiCompatible";

function fakeClient() {
  const calls: Record<string, unknown>[] = [];
  const client = {
    chat: {
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
    },
  } as unknown as OpenAI;

  return { client, calls };
}

describe("createOpenAICompatibleAdapter extraBody", () => {
  it("adds adapter-level extraBody to the request", async () => {
    const { client, calls } = fakeClient();
    const adapter = createOpenAICompatibleAdapter({
      providerLabel: "test",
      client,
      defaultModel: "m",
      extraBody: { provider: { order: ["deepinfra"] } },
    });

    await adapter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.deepEqual(calls[0].provider, { order: ["deepinfra"] });
  });

  it("resolves a function extraBody on every request", async () => {
    const { client, calls } = fakeClient();
    let order = ["deepinfra"];
    const adapter = createOpenAICompatibleAdapter({
      providerLabel: "test",
      client,
      defaultModel: "m",
      extraBody: () => ({ provider: { order } }),
    });

    await adapter.generate({ messages: [{ role: "user", content: "hi" }] });
    order = ["together"];
    await adapter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.deepEqual(calls[0].provider, { order: ["deepinfra"] });
    assert.deepEqual(calls[1].provider, { order: ["together"] });
  });

  it("does not let extraBody override model or messages", async () => {
    const { client, calls } = fakeClient();
    const adapter = createOpenAICompatibleAdapter({
      providerLabel: "test",
      client,
      defaultModel: "m",
      extraBody: { model: "other", messages: [] },
    });

    await adapter.generate({ messages: [{ role: "user", content: "hi" }] });

    assert.strictEqual(calls[0].model, "m");
    assert.strictEqual((calls[0].messages as unknown[]).length, 1);
  });
});
