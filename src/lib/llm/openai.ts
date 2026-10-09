import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.PLATFORM_LLM_URL,
});

export default createOpenAICompatibleAdapter({
  providerLabel: "openai",
  client,
  defaultModel: "gpt-5-chat-latest",
}) satisfies LLMAdapter;
