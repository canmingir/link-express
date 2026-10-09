import OpenAI from "openai";

import { log } from "./logger";
import { parseJsonWithRepair } from "./jsonParse";
import type { GenerateParams, LLMAdapter } from "./types";

type OpenAICompatibleOptions = {
  providerLabel: string;
  client?: OpenAI;
  apiKey?: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  defaultModel: string;
  jsonModeFallback?: boolean;
  forceJsonSystemPrompt?: boolean;
  extractCost?: boolean;
};

type ProviderError = {
  message?: string;
  code?: string | number;
  metadata?: { error_type?: string };
};

type OpenAIErrorResponse = {
  error?: ProviderError;
};

const MAX_ATTEMPTS = 2;
const RETRYABLE_CODES = new Set([408, 429, 500, 502, 503, 504]);

function choiceError(choice: OpenAI.ChatCompletion.Choice) {
  const { error } = choice as { error?: ProviderError };

  if (error) return error;

  if ((choice.finish_reason as string) === "error") {
    return { message: "provider finished the response with an error" };
  }

  return undefined;
}

function isRetryable(error: ProviderError) {
  return (
    RETRYABLE_CODES.has(Number(error.code)) ||
    error.metadata?.error_type === "provider_unavailable"
  );
}

function describe(providerLabel: string, error: ProviderError) {
  const code = error.code ? ` (${error.code})` : "";
  const type = error.metadata?.error_type
    ? ` [${error.metadata.error_type}]`
    : "";
  const details = error.message || "response contains no choices";

  return `${providerLabel} request failed${code}${type}: ${details}`;
}

function isResponseFormatError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("response_format") ||
    message.includes("json_object") ||
    (err as { status?: number })?.status === 400
  );
}

function createOpenAICompatibleAdapter(
  options: OpenAICompatibleOptions
): LLMAdapter {
  const {
    providerLabel,
    apiKey,
    baseURL,
    defaultHeaders,
    defaultModel,
    jsonModeFallback = false,
    forceJsonSystemPrompt = false,
    extractCost = false,
  } = options;

  const client =
    options.client ?? new OpenAI({ apiKey: apiKey ?? "", baseURL, defaultHeaders });

  return {
    async generate({
      model = defaultModel,
      messages = [],
      responseFormat,
      temperature = 0,
      max_tokens = 8192,
      meta,
    }: GenerateParams) {
      const chatMessages = [
        ...messages,
        ...(responseFormat
          ? [
              {
                role: "system" as const,
                content: `Respond with ONLY valid JSON matching this format: ${responseFormat}`,
              },
            ]
          : []),
        ...(forceJsonSystemPrompt
          ? [
              {
                role: "system" as const,
                content:
                  "IMPORTANT: You MUST respond with ONLY valid JSON that matches the format specified. Do NOT include any text before or after the JSON. Do NOT wrap the JSON in markdown code blocks. Output ONLY the raw JSON object.",
              },
            ]
          : []),
      ];

      const baseParams: Parameters<typeof client.chat.completions.create>[0] = {
        model,
        messages: chatMessages as OpenAI.ChatCompletionMessageParam[],
        stream: false,
        temperature,
        ...(max_tokens && { max_tokens }),
      };

      const request = async () => {
        try {
          return (await client.chat.completions.create({
            ...baseParams,
            response_format: { type: "json_object" },
          })) as OpenAI.ChatCompletion;
        } catch (err) {
          if (jsonModeFallback && isResponseFormatError(err)) {
            console.warn(
              `Model ${model} does not support response_format, retrying without it.`
            );
            return (await client.chat.completions.create(
              baseParams
            )) as OpenAI.ChatCompletion;
          }
          throw err;
        }
      };

      let response: OpenAI.ChatCompletion;
      let firstChoice: OpenAI.ChatCompletion.Choice;

      for (let attempt = 1; ; attempt++) {
        const startedAt = Date.now();
        response = await request();

        const choice = response.choices?.[0];

        if (choice) {
          const usage = response.usage as
            | (OpenAI.CompletionUsage & { cost?: number })
            | undefined;

          if (usage) {
            const { prompt_tokens, completion_tokens } = usage;
            console.info({ prompt_tokens, completion_tokens });
          }

          log({
            provider: providerLabel,
            model: response.model || model,
            messages: chatMessages,
            response,
            inputTokens: usage?.prompt_tokens,
            outputTokens: usage?.completion_tokens,
            totalTokens: usage?.total_tokens,
            cost: extractCost ? usage?.cost : undefined,
            durationMs: Date.now() - startedAt,
            meta,
          });
        }

        const error = choice
          ? choiceError(choice)
          : (response as unknown as OpenAIErrorResponse).error ?? {};

        if (!error) {
          firstChoice = choice!;
          break;
        }

        if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
          console.warn(
            `${describe(providerLabel, error)}. Retrying (${attempt}/${
              MAX_ATTEMPTS - 1
            }).`
          );
          continue;
        }

        throw new Error(describe(providerLabel, error));
      }

      const content = firstChoice.message.content;
      const usage = response.usage;

      if (!content) {
        if (firstChoice.finish_reason === "length") {
          throw new Error(
            `${providerLabel} truncated the response for model ${model} before any content was produced ` +
              `(max_tokens=${max_tokens}, reasoning_tokens=${
                (
                  usage as {
                    completion_tokens_details?: { reasoning_tokens?: number };
                  }
                )?.completion_tokens_details?.reasoning_tokens ?? 0
              }). Raise max_tokens or disable reasoning for this model.`
          );
        }
        throw new Error(`${providerLabel} is not responding`);
      }

      return parseJsonWithRepair(content, providerLabel) as Record<
        string,
        unknown
      >;
    },
  };
}

export { createOpenAICompatibleAdapter };
export type { OpenAICompatibleOptions };
