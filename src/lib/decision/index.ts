import { choice, noul, score } from "@typesafe-ai/sdk";
import type { EntryType, Questions } from "@typesafe-ai/sdk";

import { hasRef } from "../dataset";
import { inferSource } from "../llm";
import type { LLMMeta } from "../llm/types";
import router from "./router";
import type { DecisionAdapter, DecisionAnswers } from "./types";

type AdapterModule = { default: DecisionAdapter };

const PROVIDER_LOADERS: Record<string, () => Promise<AdapterModule>> = {
  typesafe: () => import("./typesafe"),
  cloudflare: () => import("./cloudflare"),
  openrouter: () => import("./openrouter"),
  laya: () => import("./laya"),
};

const adapters = new Map<string, Promise<DecisionAdapter>>();

function parseProviderModel(raw: string): {
  provider: string;
  model?: string;
} {
  const slashIdx = raw.indexOf("/");
  const providerPart = slashIdx === -1 ? raw : raw.slice(0, slashIdx);
  const modelPart = slashIdx === -1 ? undefined : raw.slice(slashIdx + 1);
  const provider = providerPart.trim().toLowerCase();

  if (!(provider in PROVIDER_LOADERS)) {
    throw new Error(
      `Unknown decision provider "${providerPart}" in PLATFORM_DECISION="${raw}". ` +
        `Expected "<provider>/<model>" (or just "<provider>") where provider is one of: ` +
        Object.keys(PROVIDER_LOADERS).join(", "),
    );
  }

  return { provider, model: modelPart || undefined };
}

function getAdapter(provider: string): Promise<DecisionAdapter> {
  const cached = adapters.get(provider);

  if (cached) {
    return cached;
  }

  const pending = PROVIDER_LOADERS[provider]()
    .then((mod) => mod.default)
    .catch((err) => {
      adapters.delete(provider);
      throw err;
    });

  adapters.set(provider, pending);
  return pending;
}

async function ask<const Q extends Questions>({
  model,
  state,
  questions,
  meta,
}: {
  model?: string;
  state: EntryType;
  questions: Q;
  meta?: LLMMeta;
}): Promise<DecisionAnswers<Q>> {
  const resolvedSource = meta?.source ? undefined : inferSource(ask);
  const { provider, model: configuredModel } = parseProviderModel(
    process.env.PLATFORM_DECISION || "typesafe",
  );

  const adapter = hasRef(questions) ? router : await getAdapter(provider);

  return await adapter.ask({
    provider,
    model: model ?? configuredModel,
    state,
    questions,
    meta: resolvedSource ? { ...meta, source: resolvedSource } : meta,
  });
}

export { ask, choice, noul, score };
export type { DecisionAdapter, DecisionAnswers, DecisionParams } from "./types";
