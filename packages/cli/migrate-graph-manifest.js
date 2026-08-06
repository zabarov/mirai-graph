#!/usr/bin/env node

const path = require("path");
const { applyMigration, migratePlan } = require("./graph-manifest");

function usage() {
  console.error("Usage: mirai-graph migrate [target-dir] [--owner <owner>] [--apply]");
}

function main() {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let owner;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") { apply = true; continue; }
    if (arg === "--owner") {
      owner = args[index + 1];
      if (!owner) throw new Error("--owner requires a value");
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) { usage(); throw new Error(`unknown option ${arg}`); }
    target = path.resolve(arg);
  }
  const result = apply ? applyMigration(target, { owner }) : migratePlan(target, { owner });
  console.log(JSON.stringify(result, null, 2));
  if (result.manifest_status === "conflict" || result.status === "fail") process.exitCode = 2;
  else if (!result.can_execute_now && result.manifest_status !== "missing") process.exitCode = 3;
}

try { main(); } catch (error) { console.error(error.message); process.exit(1); }
