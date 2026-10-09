import type { LLMLogEntry, LLMLogger } from "./types";

let _logger: LLMLogger | null = null;

function setLogger(logger: LLMLogger | null): void {
  _logger = logger;
}

function log(entry: LLMLogEntry): void {
  try {
    _logger?.(entry);
  } catch (err) {
    console.error("Failed to log LLM call:", err);
  }
}

export { setLogger, log };
