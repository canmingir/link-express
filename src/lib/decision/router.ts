import type { Questions } from "@typesafe-ai/sdk";

import { errorMessage, log } from "../llm/logger";
import { routerFetch } from "../routerFetch";
import type { DecisionAdapter, DecisionAnswers, DecisionParams } from "./types";

type RouterResponse<Q extends Questions> = {
  answers?: DecisionAnswers<Q>;
  model?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost?: number;
  } | null;
  error?: string;
};

async function ask<const Q extends Questions>({
  provider,
  model,
  state,
  questions,
  meta,
}: DecisionParams<Q>): Promise<DecisionAnswers<Q>> {
  const url = process.env.PLATFORM_ROUTER_URL;
  const token = process.env.PLATFORM_ROUTER_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Dataset few-shots are served by the router. Set PLATFORM_ROUTER_URL and PLATFORM_ROUTER_TOKEN.",
    );
  }

  const startedAt = Date.now();

  try {
    const response = await routerFetch(`${url.replace(/\/+$/, "")}/decide`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        model,
        state,
        questions,
        source: meta?.source,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as RouterResponse<Q>;

    if (!response.ok || !body.answers) {
      throw new Error(
        `router request failed (${response.status}): ${
          body.error ?? response.statusText
        }`,
      );
    }

    log({
      provider: "router",
      model: body.model ?? null,
      messages: { state, questions },
      response: body.answers,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
      cost: body.usage?.cost ?? null,
      durationMs: Date.now() - startedAt,
      meta,
    });

    return body.answers;
  } catch (error) {
    log({
      provider: "router",
      model: null,
      messages: { state, questions },
      durationMs: Date.now() - startedAt,
      error: errorMessage(error),
      meta,
    });

    throw error;
  }
}

export default { ask } satisfies DecisionAdapter;
