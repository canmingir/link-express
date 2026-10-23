import { hasRef } from "../dataset";
import { credentialFor } from "./credentials";
import { errorMessage, log } from "./logger";
import type { GenerateParams, LLMAdapter } from "./types";

type RouterResponse = {
  result?: Record<string, unknown>;
  model?: string | null;
  error?: string;
};

function usesRouter(messages: GenerateParams["messages"]): boolean {
  return messages.some(({ content }) => hasRef(content));
}

async function generate({
  provider,
  model,
  messages = [],
  responseFormat,
  temperature,
  max_tokens,
  meta,
}: GenerateParams & { provider?: string }) {
  const url = process.env.PLATFORM_ROUTER_URL;

  if (!url) {
    throw new Error(
      "Dataset references are served by the router. Set PLATFORM_ROUTER_URL."
    );
  }

  const key = provider ? credentialFor(provider) : undefined;

  const startedAt = Date.now();

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/generate`, {
      method: "POST",
      headers: {
        ...(key && { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        model,
        ...(provider === "bedrock" && { region: process.env.AWS_REGION }),
        messages,
        responseFormat,
        temperature,
        max_tokens,
        source: meta?.source,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as RouterResponse;

    if (!response.ok || !body.result) {
      throw new Error(
        `router request failed (${response.status}): ${
          body.error ?? response.statusText
        }`
      );
    }

    log({
      provider: "router",
      model: body.model ?? null,
      messages,
      response: body.result,
      durationMs: Date.now() - startedAt,
      meta,
    });

    return body.result;
  } catch (err) {
    log({
      provider: "router",
      messages,
      durationMs: Date.now() - startedAt,
      error: errorMessage(err),
      meta,
    });
    throw err;
  }
}

export { usesRouter };
export default { generate } satisfies LLMAdapter;
