#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const node = process.execPath;

function usage() {
  console.error("Usage:");
  console.error("  mirai-graph validate <package-dir>");
  console.error("  mirai-graph report validation <package-dir>");
  console.error("  mirai-graph report process-transition <state-machine-file> <transition-request-file>");
  console.error("  mirai-graph report technology-quality-feedback <feedback-file>");
  console.error("  mirai-graph explain process-transition <state-machine-file> <transition-request-file>");
  console.error("  mirai-graph report playground");
  console.error("");
  console.error("Boundary:");
  console.error("  Reports explain validation decisions. They do not authorize canonical updates.");
}

function run(script, args) {
  const result = spawnSync(node, [path.join(root, script), ...args], {
    cwd: root,
    stdio: "inherit"
  });
  process.exit(result.status === null ? 1 : result.status);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const [command, subcommand, ...rest] = args;

if (command === "validate") {
  if (!subcommand) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", [subcommand, ...rest]);
}

if (command === "report" && subcommand === "validation") {
  if (rest.length !== 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", ["--markdown", rest[0]]);
}

if ((command === "report" || command === "explain") && subcommand === "process-transition") {
  if (rest.length !== 2) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", ["--markdown", "process-transition", rest[0], rest[1]]);
}

if (command === "report" && subcommand === "technology-quality-feedback") {
  if (rest.length !== 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", ["--markdown", "technology-quality-feedback", rest[0]]);
}

if (command === "report" && subcommand === "playground") {
  if (rest.length !== 0) {
    usage();
    process.exit(1);
  }
  run("packages/cli/playground-demo.js", []);
}

usage();
process.exit(1);
