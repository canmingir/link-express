import fs from "fs";

const prePush = `#!/usr/bin/env bun
const { execSync } = require("child_process");

try {
  execSync("bun run lint");
  execSync("bun run test");
} catch (err) {
  console.log(err.stdout.toString());
  process.exit(1);
}
`;

fs.writeFileSync(`${__dirname}/.git/hooks/pre-push`, prePush);
