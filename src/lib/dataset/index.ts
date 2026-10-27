import fs from "node:fs";
import path from "node:path";

const MARKER = '"$dataset":';

type DatasetRef = {
  $dataset: string;
  where?: Record<string, string>;
};

type Source<T> = T[] | DatasetRef;

function directory(): string {
  return process.env.DATASET_DIR || path.resolve("src", "dataset");
}

function file(name: string, dir = directory()): string {
  const [group, ...rest] = name.split("-");
  return path.join(dir, group, `${rest.join("-")}.json`);
}

function isRef<T>(source: Source<T>): source is DatasetRef {
  return !Array.isArray(source);
}

function hasRef(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return !!text && text.includes(MARKER);
}

function load(name: string): Source<unknown> {
  const location = file(name);

  if (!fs.existsSync(location)) {
    return { $dataset: name };
  }

  return JSON.parse(fs.readFileSync(location, "utf8")).data;
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
export { file, hasRef, isRef, load, select };
