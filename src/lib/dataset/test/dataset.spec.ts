import { describe, it, beforeEach, afterEach, afterAll } from "bun:test";
import assert from "assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { load, pull } from "../index";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "link-dataset-"));

function write(name: string, data: unknown[]) {
  const [group, ...rest] = name.split("-");
  const location = path.join(root, group, `${rest.join("-")}.json`);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, JSON.stringify({ data }));
}

describe("dataset", () => {
  const env = { ...process.env };

  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    process.env.DATASET_DIR = root;
    delete process.env.PLATFORM_ROUTER_URL;
    delete process.env.PLATFORM_ROUTER_TOKEN;
    delete process.env.HF_ORG;
    delete process.env.HF_TOKEN;
    process.env.HF_HOME = path.join(root, "no-hf-home");
  });

  afterEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe("load", () => {
    it("reads the file when it exists, even with a router configured", () => {
      write("decision-action-diamond", [{ id: 1 }]);
      process.env.PLATFORM_ROUTER_URL = "https://router.test";
      process.env.PLATFORM_ROUTER_TOKEN = "secret";

      assert.deepStrictEqual(load("decision-action-diamond"), [{ id: 1 }]);
    });

    it("returns a router reference when the file is missing and a router is configured", () => {
      process.env.PLATFORM_ROUTER_URL = "https://router.test";
      process.env.PLATFORM_ROUTER_TOKEN = "secret";

      assert.deepStrictEqual(load("decision-action-diamond"), {
        $dataset: "decision-action-diamond",
      });
    });

    it("returns no rows when there is neither a file nor a router", () => {
      process.env.PLATFORM_ROUTER_URL = "https://router.test";

      assert.deepStrictEqual(load("decision-action-diamond"), []);
    });

    it("rejects names without a group", () => {
      assert.throws(() => load("policy"), /<group>-<name>/);
    });
  });

  describe("pull", () => {
    it("skips without HF_ORG", async () => {
      process.env.HF_TOKEN = "hf";

      assert.deepStrictEqual(await pull(), {
        pulled: false,
        reason: "HF_ORG is not set",
      });
    });

    it("skips without a token", async () => {
      process.env.HF_ORG = "acme";

      const result = await pull();

      assert.strictEqual(result.pulled, false);
    });

    it("downloads every dataset of the organization into the dataset directory", async () => {
      const requests: { path: string; auth: string | null }[] = [];
      const server = Bun.serve({
        port: 0,
        fetch(req) {
          const url = new URL(req.url);
          requests.push({
            path: url.pathname + url.search,
            auth: req.headers.get("authorization"),
          });

          if (url.pathname === "/api/datasets") {
            return Response.json([
              { id: "acme/llm-policy" },
              { id: "acme/decision-action-diamond" },
              { id: "acme/notes-readme" },
            ]);
          }

          if (url.pathname === "/datasets/acme/llm-policy/resolve/main/data/train.jsonl") {
            return new Response('{"rule":"a"}\n{"rule":"b"}\n');
          }

          if (url.pathname === "/datasets/acme/decision-action-diamond/resolve/main/data/train.jsonl") {
            return new Response('{"id":1}\n');
          }

          return new Response("not found", { status: 404 });
        },
      });

      try {
        process.env.HF_ENDPOINT = `http://127.0.0.1:${server.port}`;
        process.env.HF_ORG = "acme";
        process.env.HF_TOKEN = "hf-secret";

        const result = await pull();

        assert.deepStrictEqual(result, {
          pulled: true,
          org: "acme",
          dir: root,
          names: ["decision-action-diamond", "llm-policy"],
          skipped: ["notes-readme"],
        });
        assert.strictEqual(requests[0].path, "/api/datasets?author=acme&limit=1000");
        assert.ok(requests.every(({ auth }) => auth === "Bearer hf-secret"));
        assert.deepStrictEqual(load("llm-policy"), [{ rule: "a" }, { rule: "b" }]);
        assert.deepStrictEqual(load("decision-action-diamond"), [{ id: 1 }]);
      } finally {
        server.stop(true);
      }
    });

    it("fails when the organization has a dataset that is not <group>-<name>", async () => {
      const server = Bun.serve({
        port: 0,
        fetch: () => Response.json([{ id: "acme/policy" }]),
      });

      try {
        process.env.HF_ENDPOINT = `http://127.0.0.1:${server.port}`;
        process.env.HF_ORG = "acme";
        process.env.HF_TOKEN = "hf";

        await assert.rejects(() => pull(), /must be named <group>-<name>: policy/);
      } finally {
        server.stop(true);
      }
    });
  });
});
