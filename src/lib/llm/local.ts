import OpenAI from "openai";

import { createOpenAICompatibleAdapter } from "./openaiCompatible";
import type { LLMAdapter } from "./types";

const client = new OpenAI({
  apiKey: "ollama",
  baseURL: process.env.PLATFORM_LLM_URL || "http://localhost:11434/v1",
});

export default createOpenAICompatibleAdapter({
  providerLabel: "local",
  client,
  defaultModel: "llama3.2",
  forceJsonSystemPrompt: true,
}) satisfies LLMAdapter;
