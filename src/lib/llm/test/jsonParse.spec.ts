import { describe, it } from "bun:test";
import assert from "assert";

import {
  parseJsonContent,
  parseJsonWithRepair,
  parseWithBraceRepair,
  repairUnbalancedJSON,
  quoteUnquotedKeys,
  unwrapSchemaValues,
} from "../jsonParse";

describe("parseJsonContent", () => {
  it("parses clean JSON", () => {
    assert.deepEqual(parseJsonContent('{"a":1}', "test"), { a: 1 });
  });

  it("strips a markdown fence", () => {
    assert.deepEqual(parseJsonContent('```json\n{"a":1}\n```', "test"), {
      a: 1,
    });
  });

  it("throws a descriptive error on invalid JSON", () => {
    assert.throws(
      () => parseJsonContent("not json", "test"),
      /Failed to parse test response as JSON/,
    );
  });
});

describe("repairUnbalancedJSON", () => {
  it("returns null when braces are already balanced", () => {
    assert.strictEqual(repairUnbalancedJSON('{"a":1}'), null);
  });

  it("appends missing closing braces", () => {
    const repaired = repairUnbalancedJSON('{"a": {"b": 1}');
    assert.strictEqual(repaired, '{"a": {"b": 1}}');
    assert.deepEqual(JSON.parse(repaired as string), { a: { b: 1 } });
  });

  it("does not count braces inside string literals", () => {
    const repaired = repairUnbalancedJSON('{"a": "unterminated { brace"');
    assert.doesNotThrow(() => JSON.parse(repaired as string));
    assert.deepEqual(JSON.parse(repaired as string), {
      a: "unterminated { brace",
    });
  });
});

describe("quoteUnquotedKeys", () => {
  it("quotes bare identifier keys", () => {
    assert.strictEqual(
      quoteUnquotedKeys("{ next_step: 1 }"),
      '{ "next_step": 1 }',
    );
  });

  it("does not corrupt colons inside string values", () => {
    const input = '{ "note": "ratio is 1: 2", next_step: 1 }';
    const output = quoteUnquotedKeys(input);
    assert.strictEqual(output, '{ "note": "ratio is 1: 2", "next_step": 1 }');
    assert.deepEqual(JSON.parse(output), {
      note: "ratio is 1: 2",
      next_step: 1,
    });
  });
});

describe("unwrapSchemaValues", () => {
  it("unwraps {type, value} schema wrappers", () => {
    const input = { decision: { type: "string", value: "KNOWLEDGE" } };
    assert.deepEqual(unwrapSchemaValues(input), { decision: "KNOWLEDGE" });
  });

  it("recursively parses stringified JSON found in leaf string values", () => {
    const input = { payload: '{"nested":true}' };
    assert.deepEqual(unwrapSchemaValues(input), { payload: { nested: true } });
  });

  it("leaves plain values untouched", () => {
    assert.deepEqual(unwrapSchemaValues({ answer: "hello", confidence: 1 }), {
      answer: "hello",
      confidence: 1,
    });
  });
});

describe("parseWithBraceRepair", () => {
  it("parses valid JSON directly", () => {
    assert.deepEqual(parseWithBraceRepair('{"a":1}'), { a: 1 });
  });

  it("repairs unbalanced JSON", () => {
    assert.deepEqual(parseWithBraceRepair('{"a": 1'), { a: 1 });
  });

  it("returns undefined when unrecoverable", () => {
    assert.strictEqual(parseWithBraceRepair("not json at all"), undefined);
  });
});

describe("parseJsonWithRepair", () => {
  it("parses clean JSON via the fast path", () => {
    assert.deepEqual(parseJsonWithRepair('{"decision":"KNOWLEDGE"}', "test"), {
      decision: "KNOWLEDGE",
    });
  });

  it("extracts JSON from a fenced code block embedded in prose", () => {
    const content =
      'Here is the answer:\n```json\n{"answer": "42"}\n```\nHope that helps.';
    assert.deepEqual(parseJsonWithRepair(content, "test"), { answer: "42" });
  });

  it("extracts the first JSON-like substring and quotes unquoted keys", () => {
    const content =
      'Sure, here it is: { decision: "KNOWLEDGE", confidence: 0.9 } — done.';
    assert.deepEqual(parseJsonWithRepair(content, "test"), {
      decision: "KNOWLEDGE",
      confidence: 0.9,
    });
  });

  it("repairs a dropped closing brace (Llama-on-Bedrock style truncation)", () => {
    const content = '{"decision": "KNOWLEDGE", "confidence": 0.8';
    assert.deepEqual(parseJsonWithRepair(content, "test"), {
      decision: "KNOWLEDGE",
      confidence: 0.8,
    });
  });

  it("throws with a content snippet when nothing is recoverable", () => {
    assert.throws(
      () => parseJsonWithRepair("no json here whatsoever", "test"),
      /Failed to parse test response as JSON/,
    );
  });
});
