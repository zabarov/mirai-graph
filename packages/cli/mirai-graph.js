#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const node = process.execPath;

function usage() {
  console.error("Usage:");
  console.error("  mirai-graph validate <package-dir>");
  console.error("  mirai-graph init [target-dir] --profile <profile> [--template <template>] [--force]");
  console.error("  mirai-graph detect [target-dir] [--json|--markdown]");
  console.error("  mirai-graph bootstrap [target-dir] --mode detect|suggest [--profile auto|<profile>] [--output <dir>] [--json|--markdown]");
  console.error("  mirai-graph choose-profile");
  console.error("  mirai-graph adopter plan <role-or-profile>");
  console.error("  mirai-graph adopter report <template-dir>");
  console.error("  mirai-graph report validation <package-dir>");
  console.error("  mirai-graph report process-transition <state-machine-file> <transition-request-file>");
  console.error("  mirai-graph report technology-quality-feedback <feedback-file>");
  console.error("  mirai-graph report dynamic-episode <trace-file>");
  console.error("  mirai-graph report instrumentation [package-dir]");
  console.error("  mirai-graph explain process-transition <state-machine-file> <transition-request-file>");
  console.error("  mirai-graph report playground");
  console.error("  mirai-graph release state [--markdown] [--require-git-tag] [--require-github-release] [--require-npm-published]");
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

if (command === "init" || command === "detect" || command === "bootstrap") {
  const forwarded = subcommand ? [subcommand, ...rest] : rest;
  run("packages/cli/self-service-onboarding.js", [command, ...forwarded]);
}

if (command === "validate") {
  if (!subcommand) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", [subcommand, ...rest]);
}

if (command === "choose-profile") {
  if (subcommand || rest.length !== 0) {
    usage();
    process.exit(1);
  }
  run("packages/cli/adopter-workflow.js", ["choose-profile"]);
}

if (command === "adopter" && subcommand === "plan") {
  if (rest.length !== 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/adopter-workflow.js", ["plan", rest[0]]);
}

if (command === "adopter" && subcommand === "report") {
  if (rest.length !== 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/adopter-workflow.js", ["report", rest[0]]);
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

if (command === "report" && subcommand === "dynamic-episode") {
  if (rest.length !== 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/validate-mirai-graph.js", ["--markdown", "dynamic-episode-trace", rest[0]]);
}

if (command === "report" && subcommand === "instrumentation") {
  if (rest.length > 1) {
    usage();
    process.exit(1);
  }
  run("packages/cli/instrumentation-report.js", rest);
}

if (command === "report" && subcommand === "playground") {
  if (rest.length !== 0) {
    usage();
    process.exit(1);
  }
  run("packages/cli/playground-demo.js", []);
}

if (command === "release" && subcommand === "state") {
  run("packages/cli/release-state.js", rest);
}

usage();
process.exit(1);
