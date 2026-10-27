import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

const DEFAULT_PROVIDERS = ["deepinfra/bf16"];

function providerPreferences() {
  const fromEnv = (process.env.OPENROUTER_PROVIDER || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  const order = fromEnv.length ? fromEnv : DEFAULT_PROVIDERS;

  return { provider: { order, allow_fallbacks: false } };
}

function createOpenRouterAdapter({
  apiKey = process.env.OPENROUTER_API_KEY || "",
  baseURL = process.env.PLATFORM_LLM_URL || "https://openrouter.ai/api/v1",
}: { apiKey?: string; baseURL?: string } = {}): LLMAdapter {
  return createOpenAICompatibleAdapter({
    providerLabel: "openrouter",
    client: new OpenAI({
      apiKey,
      baseURL,
    }),
    defaultModel: "qwen/qwen3.8-27b",
    jsonModeFallback: true,
    extractCost: true,
    extraBody: providerPreferences,
  });
}

export { createOpenRouterAdapter };
export default createOpenRouterAdapter() satisfies LLMAdapter;
