import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

function createOpenAIAdapter({
  apiKey = process.env.OPENAI_API_KEY || "",
  baseURL = process.env.PLATFORM_LLM_URL,
}: { apiKey?: string; baseURL?: string } = {}): LLMAdapter {
  return createOpenAICompatibleAdapter({
    providerLabel: "openai",
    client: new OpenAI({ apiKey, baseURL }),
    defaultModel: "gpt-5-chat-latest",
  });
}

export { createOpenAIAdapter };
export default createOpenAIAdapter() satisfies LLMAdapter;
