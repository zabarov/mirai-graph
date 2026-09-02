#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/mirai.js");
const example = "examples/mirai-autonomic-fabric-minimal";
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-2.2-cli-"));

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, expected, `mirai ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

try {
  run(["source", "connect", `${example}/source-descriptor.json`]);
  run(["source", "snapshot", `${example}/source-descriptor.json`, "--out", path.join(temporary, "snapshot.json"), "--units-out", path.join(temporary, "units.json")]);
  run(["assimilate", "reconcile", `${example}/results/conversion-result.json`, "--out", path.join(temporary, "knowledge.json")]);
  run(["identity", "resolve", `${example}/results/conversion-result.json`]);
  run(["technology", "discover", `${example}/results/process-observations.json`, "--out", path.join(temporary, "processes.json")]);
  run(["autonomy", "validate", `${example}/results/autonomy-envelope.json`, "--at", "2026-09-02T12:00:00.000Z"]);
  run(["evolution", "evaluate", `${example}/results/evolution-proposal.json`, "--envelope", `${example}/results/autonomy-envelope.json`, "--at", "2026-09-02T12:00:00.000Z", "--out", path.join(temporary, "decision.json")]);
  const cycle = run(["autonomic", "reconcile", "--once", "--input", `${example}/results/autonomic-cycle-input.json`]);
  assert.equal(JSON.parse(cycle.stdout).canonical_write_allowed, false);
  run(["evolution", "evaluate", `${example}/invalid-protected-change.json`, "--envelope", `${example}/results/autonomy-envelope.json`, "--at", "2026-09-02T12:00:00.000Z", "--out", path.join(temporary, "denied.json")], 2);

  const home = path.join(temporary, "home");
  const rootState = path.join(temporary, "managed-project");
  fs.mkdirSync(rootState, { recursive: true });
  const authorization = path.join(temporary, "authorization.json");
  run(["autonomy", "authorize", `${example}/results/autonomy-envelope.json`, "--approve", "--approved-by", "fixture-owner", "--home", home, "--out", authorization]);
  const promotion = path.join(temporary, "promotion.json");
  run(["evolution", "apply", `${example}/results/evolution-proposal.json`, "--decision", `${example}/results/evolution-decision.json`, "--envelope", `${example}/results/autonomy-envelope.json`, "--authorization", authorization, "--home", home, "--root", rootState, "--apply", "--out", promotion]);
  const status = run(["autonomic", "status", "--root", rootState]);
  assert.equal(JSON.parse(status.stdout).status, "available");
  run(["evolution", "rollback", promotion, "--root", rootState, "--state-ref", ".mirai/adaptive/state.json", "--apply"]);
  process.stdout.write(`${JSON.stringify({ status: "passed", command_groups: 10, managed_apply_and_rollback: true, canonical_write_allowed: false }, null, 2)}\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
