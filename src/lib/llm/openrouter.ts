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
  const reasoning = reasoningPreferences();

  return {
    provider: { order, allow_fallbacks: false },
    ...(reasoning && { reasoning }),
  };
}

const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const REASONING_DISABLED = new Set(["", "off", "none", "false"]);
const REASONING_MODEL_DEFAULT = new Set(["on", "true", "default"]);

function reasoningPreferences() {
  const value = (process.env.PLATFORM_LLM_REASONING || "").trim().toLowerCase();

  if (REASONING_DISABLED.has(value)) {
    return { enabled: false };
  }

  if (REASONING_MODEL_DEFAULT.has(value)) {
    return undefined;
  }

  if (REASONING_EFFORTS.has(value)) {
    return { effort: value };
  }

  const maxTokens = Number(value);

  if (Number.isInteger(maxTokens) && maxTokens > 0) {
    return { max_tokens: maxTokens };
  }

  throw new Error(
    `Invalid PLATFORM_LLM_REASONING="${process.env.PLATFORM_LLM_REASONING}". ` +
      `Expected off, on, ${[...REASONING_EFFORTS].join(", ")} or a positive token count.`
  );
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
