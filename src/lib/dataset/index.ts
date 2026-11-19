import fs from "node:fs";

import { directory, file } from "./location";

const MARKER = '"$dataset":';

type DatasetRef = {
  $dataset: string;
  where?: Record<string, string>;
};

type Source<T> = T[] | DatasetRef;

function isRef<T>(source: Source<T>): source is DatasetRef {
  return !Array.isArray(source);
}

function hasRef(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return !!text && text.includes(MARKER);
}

function hasRouter(): boolean {
  return !!(
    process.env.PLATFORM_ROUTER_URL && process.env.PLATFORM_ROUTER_TOKEN
  );
}

function load(name: string): Source<unknown> {
  const location = file(name);

  if (fs.existsSync(location)) {
    return JSON.parse(fs.readFileSync(location, "utf8")).data;
  }

  return hasRouter() ? { $dataset: name } : [];
}

function pick(value: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      value
    );
}

function select<T>(
  source: Source<T>,
  where: Record<string, string>
): Source<T> {
  if (isRef(source)) {
    return { ...source, where: { ...source.where, ...where } };
  }

  return source.filter((item) =>
    Object.entries(where).every(([key, value]) => pick(item, key) === value)
  );
}

export type { DatasetRef, Source };
export type { PullOptions, PullResult } from "./pull";
export { directory, file, hasRef, isRef, load, select };
export { pull } from "./pull";
