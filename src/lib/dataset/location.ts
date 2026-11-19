import path from "node:path";

const NAME = /^\w+-[\w-]+$/;

function directory(): string {
  return process.env.DATASET_DIR || path.resolve("src", "dataset");
}

function isName(name: string): boolean {
  return NAME.test(name);
}

function file(name: string, dir = directory()): string {
  if (!isName(name)) {
    throw new Error(`Dataset name "${name}" must look like <group>-<name>`);
  }

  const [group, ...rest] = name.split("-");
  return path.join(dir, group, `${rest.join("-")}.json`);
}

export { directory, file, isName };
