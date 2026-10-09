import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message,
} from "@aws-sdk/client-bedrock-runtime";

import { log } from "./logger";
import {
  parseJsonWithRepair,
  parseWithBraceRepair,
  unwrapSchemaValues,
} from "./jsonParse";
import type { GenerateParams, LLMAdapter } from "./types";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function generate({
  model = "meta.llama3-3-70b-instruct-v1:0",
  messages = [],
  responseFormat,
  meta,
}: GenerateParams): Promise<Record<string, unknown>> {
  const systemPrompts: { text: string }[] = [];
  const conversationMessages: Message[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompts.push({ text: msg.content });
    } else {
      conversationMessages.push({
        role: msg.role,
        content: [{ text: msg.content }],
      });
    }
  }

  const jsonFormat = responseFormat ?? null;
  const isQwen = model.startsWith("qwen.");

  const omitTemperature = /(^|\.)(anthropic|openai)\./.test(model);

  const useToolConfig = jsonFormat && !isQwen;

  if (isQwen && jsonFormat) {
    systemPrompts.push({
      text: `You MUST respond with ONLY valid RFC 8259 JSON (all keys double-quoted) matching this exact format, no explanation, no markdown: ${jsonFormat}`,
    });
  }

  const command = new ConverseCommand({
    modelId: model,
    system: systemPrompts,
    messages: conversationMessages,
    inferenceConfig: {
      ...(omitTemperature ? {} : { temperature: 0 }),
      maxTokens: 8192,
    },
    ...(useToolConfig && {
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "structured_output",
              description: `You MUST call this tool to return your response. The response must match this format: ${jsonFormat}`,
              inputSchema: {
                json: { type: "object" },
              },
            },
          },
        ],
        toolChoice: { auto: {} },
      },
    }),
  });

  let response;
  try {
    response = await bedrock.send(command);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("http2") || msg.includes("did not get a response")) {
      const freshClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      });
      response = await freshClient.send(command);
    } else {
      throw err;
    }
  }

  if (response.usage) {
    const { inputTokens, outputTokens } = response.usage;
    console.info({
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
    });
  }

  log({
    provider: "bedrock",
    model,
    messages,
    response,
    inputTokens: response.usage?.inputTokens,
    outputTokens: response.usage?.outputTokens,
    totalTokens: response.usage?.totalTokens,
    durationMs: response.metrics?.latencyMs,
    meta,
  });

  if (response.stopReason === "max_tokens") {
    console.error("Response was truncated due to max_tokens limit");
    throw new Error(
      "LLM response was truncated. The response exceeded the maximum token limit.",
    );
  }

  const outputContent = response.output?.message?.content;

  const toolUseBlock = outputContent?.find((block) => "toolUse" in block);
  if (toolUseBlock && "toolUse" in toolUseBlock) {
    return toolUseBlock.toolUse?.input as Record<string, unknown>;
  }

  const textBlock = outputContent?.find((block) => "text" in block);
  if (textBlock && "text" in textBlock && textBlock.text) {
    const parsed = parseWithBraceRepair(textBlock.text);
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { type?: unknown }).type === "function" &&
      (parsed as { parameters?: unknown }).parameters
    ) {
      const params = unwrapSchemaValues(
        (parsed as { parameters: unknown }).parameters,
      );
      const outerKeyMatch = jsonFormat?.match(/^\{\s*(\w+)\s*:/);
      const outerKey = outerKeyMatch?.[1];
      if (
        outerKey &&
        params &&
        typeof params === "object" &&
        !(outerKey in params)
      ) {
        return { [outerKey]: params };
      }
      return params as Record<string, unknown>;
    }

    return parseJsonWithRepair(textBlock.text, "bedrock") as Record<
      string,
      unknown
    >;
  }

  throw new Error("Bedrock is not responding");
}

export default { generate } satisfies LLMAdapter;
