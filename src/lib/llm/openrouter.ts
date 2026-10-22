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

const DEFAULT_PROVIDERS = ["deepinfra/bf16"];

function providerPreferences() {
  const fromEnv = (process.env.OPENROUTER_PROVIDER || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  const order = fromEnv.length ? fromEnv : DEFAULT_PROVIDERS;

  return { provider: { order, allow_fallbacks: false } };
}

export default createOpenAICompatibleAdapter({
  providerLabel: "openrouter",
  client,
  defaultModel: "qwen/qwen3.8-27b",
  jsonModeFallback: true,
  extractCost: true,
  extraBody: providerPreferences,
}) satisfies LLMAdapter;
