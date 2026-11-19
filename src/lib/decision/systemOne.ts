import type { Questions, TypeSafeClient } from "@typesafe-ai/sdk";

import { errorMessage, log } from "../llm/logger";
import type { DecisionAdapter, DecisionParams } from "./types";

type SystemOneOptions = {
  providerLabel: string;
  createClient: () => TypeSafeClient;
};

function createSystemOneAdapter({
  providerLabel,
  createClient,
}: SystemOneOptions): DecisionAdapter {
  let client: TypeSafeClient | null = null;

  function getClient(): TypeSafeClient {
    if (!client) {
      client = createClient();
    }
    return client;
  }

  async function ask<const Q extends Questions>({
    model,
    state,
    questions,
    meta,
  }: DecisionParams<Q>) {
    const startedAt = Date.now();

    try {
      const result = await getClient().systemOne({
        state,
        questions,
        ...(model ? { model } : {}),
      });

      log({
        provider: providerLabel,
        model: result.model,
        messages: { state, questions },
        response: result.answers,
        inputTokens: result.usage?.input_tokens ?? null,
        outputTokens: result.usage?.output_tokens ?? null,
        cost: (result.usage as { cost?: number } | undefined)?.cost ?? null,
        durationMs: Date.now() - startedAt,
        meta,
      });

      return result.answers;
    } catch (error) {
      log({
        provider: providerLabel,
        model: model ?? null,
        messages: { state, questions },
        durationMs: Date.now() - startedAt,
        error: errorMessage(error),
        meta,
      });

      throw error;
    }
  }

  return { ask };
}

export { createSystemOneAdapter };
