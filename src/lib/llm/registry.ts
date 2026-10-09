import type { LLMAdapter } from "./types";

type AdapterModule = LLMAdapter | { default: LLMAdapter };

type AdapterSource =
  | LLMAdapter
  | (() => AdapterModule | Promise<AdapterModule>);

type AdapterExtender = (base: LLMAdapter) => LLMAdapter | Promise<LLMAdapter>;

type Loader = () => Promise<LLMAdapter>;

const BUILTIN_LOADERS: Record<string, () => Promise<AdapterModule>> = {
  openai: () => import("./openai"),
  anthropic: () => import("./anthropic"),
  openrouter: () => import("./openrouter"),
  bedrock: () => import("./bedrock"),
  local: () => import("./local"),
  mock: () => import("./mock"),
};

const loaders = new Map<string, Loader>();
const cache = new Map<string, Promise<LLMAdapter>>();

function key(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    throw new Error("LLM adapter name must not be empty");
  }

  return normalized;
}

function unwrap(module: AdapterModule): LLMAdapter {
  const adapter = "default" in module ? module.default : module;

  if (!adapter || typeof adapter.generate !== "function") {
    throw new Error("LLM adapter must expose a generate(params) function");
  }

  return adapter;
}

function toLoader(source: AdapterSource): Loader {
  if (typeof source === "function") {
    return async () => unwrap(await source());
  }

  const adapter = unwrap(source);
  return async () => adapter;
}

function registerAdapter(name: string, source: AdapterSource): void {
  const id = key(name);

  loaders.set(id, toLoader(source));
  cache.delete(id);
}

function extendAdapter(name: string, extender: AdapterExtender): void {
  const id = key(name);
  const base = loaders.get(id);

  if (!base) {
    throw new Error(
      `Cannot extend unknown LLM adapter "${name}". Registered adapters: ${adapterNames().join(", ")}`,
    );
  }

  loaders.set(id, async () => unwrap({ default: await extender(await base()) }));
  cache.delete(id);
}

function hasAdapter(name: string): boolean {
  return loaders.has(key(name));
}

function adapterNames(): string[] {
  return [...loaders.keys()];
}

function getAdapter(name: string): Promise<LLMAdapter> {
  const id = key(name);
  const cached = cache.get(id);

  if (cached) {
    return cached;
  }

  const loader = loaders.get(id);

  if (!loader) {
    throw new Error(
      `Unknown LLM adapter "${name}". Registered adapters: ${adapterNames().join(", ")}`,
    );
  }

  const pending = loader().catch((err) => {
    cache.delete(id);
    throw err;
  });

  cache.set(id, pending);
  return pending;
}

function resetAdapters(): void {
  loaders.clear();
  cache.clear();

  for (const [name, load] of Object.entries(BUILTIN_LOADERS)) {
    registerAdapter(name, load);
  }
}

resetAdapters();

export {
  registerAdapter,
  extendAdapter,
  getAdapter,
  hasAdapter,
  adapterNames,
  resetAdapters,
};
export type { AdapterSource, AdapterExtender };
