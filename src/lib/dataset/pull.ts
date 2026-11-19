import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { directory, file, isName } from "./location";

type PullOptions = {
  org?: string;
  token?: string;
  dir?: string;
};

type PullResult =
  | {
      pulled: true;
      org: string;
      dir: string;
      names: string[];
      skipped: string[];
    }
  | { pulled: false; reason: string };

function hfToken(): string | undefined {
  if (process.env.HF_TOKEN) {
    return process.env.HF_TOKEN;
  }

  const home =
    process.env.HF_HOME ?? path.join(os.homedir(), ".cache", "huggingface");
  const location = path.join(home, "token");

  return fs.existsSync(location)
    ? fs.readFileSync(location, "utf8").trim() || undefined
    : undefined;
}

function endpoint(): string {
  return (process.env.HF_ENDPOINT || "https://huggingface.co").replace(
    /\/+$/,
    ""
  );
}

async function request(url: string, token: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function list(org: string, token: string): Promise<string[]> {
  const response = await request(
    `${endpoint()}/api/datasets?author=${encodeURIComponent(org)}&limit=1000`,
    token
  );
  const repos = (await response.json()) as { id: string }[];
  const names = repos.map(({ id }) => id.slice(org.length + 1));
  const invalid = names.filter((name) => !isName(name));

  if (invalid.length) {
    throw new Error(
      `Datasets in ${org} must be named <group>-<name>: ${invalid.join(", ")}`
    );
  }

  return names.sort();
}

async function download(
  org: string,
  name: string,
  dir: string,
  token: string
): Promise<boolean> {
  const url = `${endpoint()}/datasets/${org}/${name}/resolve/main/data/train.jsonl`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.text())
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  const location = file(name, dir);
  const temp = `${location}.${process.pid}.tmp`;

  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify({ data }, null, 2));
  fs.renameSync(temp, location);
  return true;
}

async function pull({
  org = process.env.HF_ORG,
  token = hfToken(),
  dir = directory(),
}: PullOptions = {}): Promise<PullResult> {
  if (!org) {
    return { pulled: false, reason: "HF_ORG is not set" };
  }

  if (!token) {
    return {
      pulled: false,
      reason: 'no Hugging Face token (set HF_TOKEN or run "hf auth login")',
    };
  }

  const names = await list(org, token);
  const results = await Promise.allSettled(
    names.map((name) => download(org, name, dir, token))
  );
  const failed = results
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )
    .map(({ reason }) =>
      reason instanceof Error ? reason.message : String(reason)
    );

  if (failed.length) {
    throw new Error(failed.join("\n"));
  }

  const found = results.map(
    (result) => result.status === "fulfilled" && result.value
  );

  return {
    pulled: true,
    org,
    dir,
    names: names.filter((_, index) => found[index]),
    skipped: names.filter((_, index) => !found[index]),
  };
}

export { pull };
export type { PullOptions, PullResult };
