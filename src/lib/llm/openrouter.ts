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

export default createOpenAICompatibleAdapter({
  providerLabel: "openrouter",
  client,
  defaultModel: "openai/gpt-4o-mini",
  jsonModeFallback: true,
  extractCost: true,
}) satisfies LLMAdapter;
