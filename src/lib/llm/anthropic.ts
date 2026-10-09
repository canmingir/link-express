import { Anthropic } from "@anthropic-ai/sdk";

import { log } from "./logger";
import { parseJsonWithRepair } from "./jsonParse";
import type { GenerateParams, LLMAdapter } from "./types";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey.trim() === "") {
  throw new Error(
    "Missing ANTHROPIC_API_KEY environment variable. Please set it to your Anthropic API key."
  );
}
const anthropic = new Anthropic({
  apiKey,
});

async function generate({
  model = "claude-haiku-4-5-20251001",
  messages = [],
  responseFormat,
  temperature = 0,
  max_tokens = 4096,
  meta,
}: GenerateParams) {
  const systemMessages = messages.filter((msg) => msg.role === "system");
  const conversationMessages = messages.filter((msg) => msg.role !== "system");

  let systemPrompt =
    systemMessages.length > 0
      ? systemMessages.map((msg) => msg.content).join("\n\n")
      : undefined;

  if (responseFormat) {
    systemPrompt = [
      systemPrompt,
      `json_format: ${responseFormat}`,
      "IMPORTANT: You MUST respond with ONLY valid JSON that matches the format specified. Do NOT include any text before or after the JSON. Do NOT wrap the JSON in markdown code blocks. Output ONLY the raw JSON object.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const params = {
    model,
    messages: conversationMessages as Anthropic.MessageParam[],
    temperature,
    max_tokens,
    ...(systemPrompt && { system: systemPrompt }),
  };

  const startedAt = Date.now();
  const reponse = await anthropic.messages.create(params);

  const { content, usage } = reponse;

  if (usage) {
    const { input_tokens, output_tokens } = usage;
    console.info({ input_tokens, output_tokens });
  }

  log({
    provider: "anthropic",
    model: reponse.model || model,
    messages,
    response: reponse,
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
    durationMs: Date.now() - startedAt,
    meta,
  });

  if (content) {
    const textContent = content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return parseJsonWithRepair(textContent, "anthropic") as Record<
      string,
      unknown
    >;
  } else {
    throw new Error("Claude is not responding");
  }
}

export default { generate } satisfies LLMAdapter;
