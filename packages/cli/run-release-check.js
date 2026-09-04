#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath_required");

const candidate = process.argv.includes("--candidate");
const scripts = [
  "test",
  "test:project-continuity",
  "test:project-technology",
  "validate:mirai-2.2-adapter-packages",
  "validate:mirai-2.2-adapter-clean-room",
  "validate:mirai-2.2-controlled-pilots",
  "test:mirai-2.2-controlled-pilots-negative",
  "validate:mirai-2.2-security-review",
  "test:mirai-2.2-security-review-negative",
  "validate:mirai-2.2-readiness",
  "validate:markdown-links"
];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const script of scripts) run(process.execPath, [npmCli, "run", script]);
if (candidate) {
  run(process.execPath, ["packages/cli/validate-mirai-2-4-readiness.js"]);
} else {
  run(process.execPath, [npmCli, "run", "validate:mirai-2.4-readiness"]);
}
run("git", ["diff", "--check"]);
