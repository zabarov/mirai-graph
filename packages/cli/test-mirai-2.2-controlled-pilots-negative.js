#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { digestValue, withoutDigest } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const runner = path.join(root, "packages/cli/run-mirai-2.2-controlled-pilots.js");
const validator = path.join(root, "packages/cli/validate-mirai-2.2-controlled-pilots.js");
const reportPath = path.join(root, "pilots/mirai-2.2-controlled-observe/pilot-result.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-controlled-pilot-negative-"));

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 30_000 });
}

try {
  const unsafeOutput = run(runner, ["--config", path.join(root, "package.json"), "--out", path.join(root, "unsafe-controlled-pilot-output.json")]);
  assert.notEqual(unsafeOutput.status, 0);
  assert.match(unsafeOutput.stderr, /controlled_pilot_output_must_be_temporary/);

  const existing = path.join(temporary, "existing.json");
  fs.writeFileSync(existing, "{}\n");
  const overwrite = run(runner, ["--config", path.join(root, "package.json"), "--out", existing]);
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /controlled_pilot_output_already_exists/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.unexpected = "field";
  report.digest = digestValue(withoutDigest(report));
  const unknownField = path.join(temporary, "unknown-field.json");
  fs.writeFileSync(unknownField, `${JSON.stringify(report, null, 2)}\n`);
  const unknownFieldResult = run(validator, ["--input", unknownField]);
  assert.notEqual(unknownFieldResult.status, 0);
  assert.match(unknownFieldResult.stderr, /report:unexpected_fields:unexpected/);

  delete report.unexpected;
  report.effect_audit.canonical_write_attempted = true;
  report.digest = digestValue(withoutDigest(report));
  const falseEffectClaim = path.join(temporary, "false-effect-claim.json");
  fs.writeFileSync(falseEffectClaim, `${JSON.stringify(report, null, 2)}\n`);
  const falseEffectResult = run(validator, ["--input", falseEffectClaim]);
  assert.notEqual(falseEffectResult.status, 0);
  assert.match(falseEffectResult.stderr, /controlled_pilot_effect_audit_failed/);

  process.stdout.write(`${JSON.stringify({ status: "passed", negative_case_count: 4 }, null, 2)}\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
