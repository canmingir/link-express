import { basename } from "node:path";
import { adapterNames, getAdapter, hasAdapter } from "./registry";
import type { LLMMeta } from "./types";

function parseProviderModel(raw: string): {
  provider: string;
  model?: string;
} {
  const slashIdx = raw.indexOf("/");
  const providerPart = slashIdx === -1 ? raw : raw.slice(0, slashIdx);
  const modelPart = slashIdx === -1 ? undefined : raw.slice(slashIdx + 1);

  if (!hasAdapter(providerPart)) {
    throw new Error(
      `Unknown LLM provider "${providerPart}" in PLATFORM_LLM="${raw}". ` +
        `Expected "<provider>/<model>" (or just "<provider>") where provider is one of: ` +
        adapterNames().join(", "),
    );
  }

  return { provider: providerPart, model: modelPart || undefined };
}

function resolveProvider(provider?: string): {
  provider: string;
  model?: string;
} {
  if (provider) {
    return { provider };
  }

  return parseProviderModel(process.env.PLATFORM_LLM || "local");
}

function toContentString(content: string | object | object[]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function inferSource(
  entry: (...args: never[]) => unknown,
): string | undefined {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    const holder: { stack?: NodeJS.CallSite[] } = {};
    Error.prepareStackTrace = (_err, stack) =>
      stack as unknown as NodeJS.CallSite[];
    Error.captureStackTrace(holder, entry);
    const caller = holder.stack?.[0];
    if (!caller) return undefined;

    const fnName = caller.getFunctionName() ?? caller.getMethodName() ?? null;
    const fileName = caller.getFileName();
    const fileLabel = fileName
      ? basename(fileName).replace(/\.[cm]?[jt]sx?$/, "")
      : null;

    if (fileLabel && fnName) return `${fileLabel}:${fnName}`;
    return fnName ?? fileLabel ?? undefined;
  } catch {
    return undefined;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}

async function generate({
  provider,
  model,
  dataset,
  policy,
  context = [],
  content,
  json_format,
  temperature = 0,
  max_tokens,
  meta,
}: {
  provider?: string;
  model?: string;
  policy?: {
    role: "system";
    content: string;
  };
  dataset?: {
    role: "system";
    content: string;
  };
  context?: {
    role: "user" | "system" | "assistant";
    content: string | object | object[];
  }[];
  content: string | object;
  json_format: string;
  temperature?: number;
  max_tokens?: number;
  meta?: LLMMeta;
}) {
  const resolvedSource = meta?.source ? undefined : inferSource(generate);

  const messages = [
    ...context.map(({ role, content }) => ({
      role,
      content: toContentString(content),
    })),
    { role: "user" as const, content: toContentString(content) },
  ];

  if (dataset) {
    messages.unshift(dataset);
  }

  if (policy) {
    messages.unshift(policy);
  }

  const resolved = resolveProvider(provider);
  const llm = await getAdapter(resolved.provider);

  return await llm.generate({
    model: model ?? resolved.model,
    messages,
    responseFormat: json_format,
    temperature,
    max_tokens,
    meta: resolvedSource ? { ...meta, source: resolvedSource } : meta,
  });
}

export { generate, inferSource };
export { setLogger, log } from "./logger";
export {
  registerAdapter,
  extendAdapter,
  getAdapter,
  hasAdapter,
  adapterNames,
  resetAdapters,
} from "./registry";
export type { AdapterSource, AdapterExtender } from "./registry";
export { createOpenAICompatibleAdapter } from "./openaiCompatible";
export type { OpenAICompatibleOptions } from "./openaiCompatible";
export { parseJsonWithRepair } from "./jsonParse";
export type {
  GenerateParams,
  LLMAdapter,
  LLMLogEntry,
  LLMLogger,
  LLMMeta,
} from "./types";
