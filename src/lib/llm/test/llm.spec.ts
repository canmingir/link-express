import { describe, it, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import assert from "assert";

import type { GenerateParams } from "../types";

const mockGenerate = mock((_params: GenerateParams) =>
  Promise.resolve({ ok: true }),
);

mock.module("../mock", () => ({
  __esModule: true,
  default: { generate: mockGenerate },
}));

describe("llm.generate", () => {
  const ORIGINAL_PLATFORM_LLM = process.env.PLATFORM_LLM;

  beforeAll(() => {
    process.env.PLATFORM_LLM = "mock";
  });

  afterAll(() => {
    process.env.PLATFORM_LLM = ORIGINAL_PLATFORM_LLM;
  });

  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it("passes json_format as a discrete responseFormat field instead of a smuggled system message", async () => {
    const { generate } = await import("../index");

    await generate({
      content: { foo: "bar" },
      json_format: "{ decision: <X> }",
    });

    assert.strictEqual(mockGenerate.mock.calls.length, 1);
    const params = mockGenerate.mock.calls[0][0] as GenerateParams;

    assert.strictEqual(params.responseFormat, "{ decision: <X> }");
    assert.strictEqual(
      params.messages.some((m) => m.content.includes("json_format")),
      false,
    );
  });

  it("does not double-stringify content that is already a plain string", async () => {
    const { generate } = await import("../index");

    await generate({
      content: "plain string content",
      json_format: "{ answer: <A> }",
      context: [{ role: "user", content: "previous turn as string" }],
    });

    const params = mockGenerate.mock.calls[0][0] as GenerateParams;
    const [contextMsg, userMsg] = params.messages;

    assert.strictEqual(contextMsg.content, "previous turn as string");
    assert.strictEqual(userMsg.content, "plain string content");
  });

  it("JSON.stringifies object/array content exactly once", async () => {
    const { generate } = await import("../index");

    await generate({
      content: { a: 1 },
      json_format: "{ x: <X> }",
    });

    const params = mockGenerate.mock.calls[0][0] as GenerateParams;
    const userMsg = params.messages[params.messages.length - 1];

    assert.strictEqual(userMsg.content, JSON.stringify({ a: 1 }));
    assert.deepEqual(JSON.parse(userMsg.content), { a: 1 });
  });

  it("still unshifts dataset/policy system messages ahead of context/content", async () => {
    const { generate } = await import("../index");

    await generate({
      content: "user question",
      json_format: "{ x: <X> }",
      dataset: { role: "system", content: "dataset context" },
      policy: { role: "system", content: "policy rules" },
    });

    const params = mockGenerate.mock.calls[0][0] as GenerateParams;

    assert.deepEqual(params.messages[0], {
      role: "system",
      content: "policy rules",
    });
    assert.deepEqual(params.messages[1], {
      role: "system",
      content: "dataset context",
    });
    assert.strictEqual(
      params.messages[params.messages.length - 1].content,
      "user question",
    );
  });
});
