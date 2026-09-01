#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const newCommands = new Set([
  "program", "compile", "simulate", "approval", "run", "resume", "cancel",
  "reconcile", "inspect", "replay", "evidence", "conformance", "source",
  "assimilate", "technology", "component", "activation"
]);

if (args[0] === "--version" || args[0] === "-v") {
  process.stdout.write(`${require(path.join(root, "package.json")).version}\n`);
  process.exit(0);
}

if (!args.length || args.includes("--help") || args.includes("-h") || newCommands.has(args[0]) || (args[0] === "migrate" && args.includes("--from"))) {
  let cli;
  try {
    cli = require(path.join(root, "dist", "cjs", "cli", "index.js"));
  } catch (error) {
    console.error("Mirai 2 runtime is not built. Run `npm run build` first.");
    process.exit(1);
  }
  Promise.resolve(cli.runCli(args)).then(
    (code) => { process.exitCode = typeof code === "number" ? code : 0; },
    (error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  );
} else {
  const result = spawnSync(process.execPath, [path.join(__dirname, "mirai-graph.js"), ...args], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  process.exit(result.status === null ? 1 : result.status);
}
