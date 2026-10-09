interface LLMMeta {
  source?: string | null;
  agentId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  teamId?: string | null;
}

type GenerateParams = {
  model?: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  responseFormat?: string;
  temperature?: number;
  max_tokens?: number;
  meta?: LLMMeta;
};

type LLMAdapter = {
  generate(params: GenerateParams): Promise<Record<string, unknown>>;
};

type LLMLogEntry = {
  provider: string;
  model?: string | null;
  messages: unknown;
  response?: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cost?: number | null;
  durationMs?: number | null;
  error?: string | null;
  meta?: LLMMeta;
};

type LLMLogger = (entry: LLMLogEntry) => void;

export type { LLMMeta, GenerateParams, LLMAdapter, LLMLogEntry, LLMLogger };
