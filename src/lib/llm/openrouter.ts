import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: process.env.PLATFORM_LLM_URL || "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "X-Title": "GreyCollar",
  },
});

function providerPreferences() {
  const order = (process.env.OPENROUTER_PROVIDER || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  if (!order.length) return undefined;

  return { provider: { order, allow_fallbacks: false } };
}

export default createOpenAICompatibleAdapter({
  providerLabel: "openrouter",
  client,
  defaultModel: "openai/gpt-4o-mini",
  jsonModeFallback: true,
  extractCost: true,
  extraBody: providerPreferences,
}) satisfies LLMAdapter;
