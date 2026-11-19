import { TypeSafeClient } from "@typesafe-ai/sdk";

import { createSystemOneAdapter } from "./systemOne";
import type { DecisionAdapter } from "./types";

const DEFAULT_MODEL = "clef-flash";
const SYSTEM_ONE_PATH = "/v1/systemone";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the cloudflare decision provider`);
  }
  return value;
}

function workersAIModelPath(model: string): string {
  return model.startsWith("@cf/") ? `/${model}` : `/@cf/cloudflare/${model}`;
}

async function workersAIFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let url = input;

  if (input.endsWith(SYSTEM_ONE_PATH) && typeof init?.body === "string") {
    const { model } = JSON.parse(init.body) as { model?: string };
    url =
      input.slice(0, -SYSTEM_ONE_PATH.length) +
      workersAIModelPath(model || DEFAULT_MODEL);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(text, { status: res.status, headers: res.headers });
  }

  const envelope = body as { result?: unknown; errors?: unknown };
  const unwrapped =
    res.ok && envelope && typeof envelope === "object" && "result" in envelope
      ? envelope.result
      : body;

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(JSON.stringify(unwrapped), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default createSystemOneAdapter({
  providerLabel: "cloudflare",
  createClient: () =>
    new TypeSafeClient({
      apiKey: requireEnv("CLOUDFLARE_AUTH_TOKEN"),
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${requireEnv(
        "CLOUDFLARE_ACCOUNT_ID",
      )}/ai/run`,
      defaultModel: DEFAULT_MODEL,
      timeout: Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 30000,
      fetch: workersAIFetch,
    }),
}) satisfies DecisionAdapter;
