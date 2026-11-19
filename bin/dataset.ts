#!/usr/bin/env bun

const [command] = process.argv.slice(2);

if (command !== "pull") {
  console.log("Usage: link-dataset pull");
  console.log("\nDownloads every dataset of the Hugging Face organization");
  console.log("HF_ORG into DATASET_DIR (default: ./src/dataset).");
  console.log("\nEnvironment:");
  console.log("  HF_ORG        Hugging Face organization to pull from");
  console.log("  HF_TOKEN      Hugging Face token (or `hf auth login`)");
  console.log("  DATASET_DIR   Target directory");
  process.exit(1);
}

const { pull } = require("../dist/src/lib/dataset/pull.js");

pull()
  .then(
    (
      result:
        | {
            pulled: true;
            org: string;
            dir: string;
            names: string[];
            skipped: string[];
          }
        | { pulled: false; reason: string }
    ) => {
      if (result.pulled) {
        console.log(
          `[dataset] Pulled ${result.names.length} datasets from ${result.org} into ${result.dir}`
        );
        if (result.skipped.length) {
          console.log(
            `[dataset] Skipped without data/train.jsonl: ${result.skipped.join(", ")}`
          );
        }
      } else {
        console.log(`[dataset] Skipped: ${result.reason}`);
      }
    }
  )
  .catch((err: unknown) => {
    console.error(
      `[dataset] ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  });
