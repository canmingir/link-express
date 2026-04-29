#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args: string[]) {
  const options: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("-p") || args[i].startsWith("--port")) {
      options.port = args[i + 1];
      i++;
    }
  }
  return options;
}

if (command === "start") {
  const options = parseArgs(args);
  if (options.port) {
    process.env.PORT = options.port;
  }
  require("../dist/src/event/server/server.js");
} else {
  console.log("Usage: event-listener start [-p <port>]");
  console.log("\nCommands:");
  console.log("  start    Start the event server");
  console.log("\nOptions:");
  console.log("  -p, --port    Port to listen on (default: 8080)");
  process.exit(1);
}
