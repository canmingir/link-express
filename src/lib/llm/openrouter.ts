import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

function createOpenRouterAdapter({
  apiKey = process.env.OPENROUTER_API_KEY || "",
  baseURL = process.env.PLATFORM_LLM_URL || "https://openrouter.ai/api/v1",
}: { apiKey?: string; baseURL?: string } = {}): LLMAdapter {
  return createOpenAICompatibleAdapter({
    providerLabel: "openrouter",
    client: new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        "X-Title": "GreyCollar",
      },
    }),
    defaultModel: "openai/gpt-4o-mini",
    jsonModeFallback: true,
    extractCost: true,
  });
}

export { createOpenRouterAdapter };
export default createOpenRouterAdapter() satisfies LLMAdapter;
