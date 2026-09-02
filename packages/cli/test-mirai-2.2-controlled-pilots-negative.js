#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { digestValue, withoutDigest } = require("../../dist/cjs/core");
const {
  CLAIM_BOUNDARY,
  INDEPENDENT_REVIEW,
  LIMITATIONS,
  OWNER_DECISION
} = require("./mirai-2.2-controlled-pilot-contract");

const root = path.resolve(__dirname, "../..");
const runner = path.join(root, "packages/cli/run-mirai-2.2-controlled-pilots.js");
const validator = path.join(root, "packages/cli/validate-mirai-2.2-controlled-pilots.js");
const reportPath = path.join(root, "pilots/mirai-2.2-controlled-observe/pilot-result.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-controlled-pilot-negative-"));

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 30_000 });
}

function validReport() {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.independent_review = INDEPENDENT_REVIEW;
  report.owner_decision = OWNER_DECISION;
  report.claim_boundary = CLAIM_BOUNDARY;
  report.limitations = [...LIMITATIONS];
  report.digest = digestValue(withoutDigest(report));
  return report;
}

try {
  const unsafeOutput = run(runner, ["--config", path.join(root, "package.json"), "--out", path.join(root, "unsafe-controlled-pilot-output.json")]);
  assert.notEqual(unsafeOutput.status, 0);
  assert.match(unsafeOutput.stderr, /controlled_pilot_output_overlaps_runner_repository/);

  const existing = path.join(temporary, "existing.json");
  fs.writeFileSync(existing, "{}\n");
  const overwrite = run(runner, ["--config", path.join(root, "package.json"), "--out", existing]);
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /controlled_pilot_output_already_exists/);

  const report = validReport();
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

  const forgedReview = validReport();
  forgedReview.independent_review = "external_human_review_complete";
  forgedReview.owner_decision = "approved_for_release";
  forgedReview.digest = digestValue(withoutDigest(forgedReview));
  const forgedReviewPath = path.join(temporary, "forged-review.json");
  fs.writeFileSync(forgedReviewPath, `${JSON.stringify(forgedReview, null, 2)}\n`);
  const forgedReviewResult = run(validator, ["--input", forgedReviewPath]);
  assert.notEqual(forgedReviewResult.status, 0);
  assert.match(forgedReviewResult.stderr, /controlled_pilot_review_claim_invalid/);

  for (const [name, privatePath] of [
    ["unix-private-path", "/custom/private/repository"],
    ["windows-private-path", "C:\\private\\repository"],
    ["file-uri", "file:///private/repository"],
    ["embedded-unix-private-path", "source:/custom/private/repository"],
    ["embedded-file-uri", "source file:///private/repository"],
    ["semicolon-unix-private-path", "source;/custom/private/repository"],
    ["parenthesis-unix-private-path", "source)/custom/private/repository"],
    ["semicolon-unc-private-path", "source;\\\\private\\repository"],
    ["bracket-unc-private-path", "source]\\\\private\\repository"]
  ]) {
    const disclosedPath = validReport();
    disclosedPath.results[0].source_alias = privatePath;
    disclosedPath.results[0].digest = digestValue(withoutDigest(disclosedPath.results[0]));
    disclosedPath.digest = digestValue(withoutDigest(disclosedPath));
    const disclosedPathFile = path.join(temporary, `${name}.json`);
    fs.writeFileSync(disclosedPathFile, `${JSON.stringify(disclosedPath, null, 2)}\n`);
    const disclosedPathResult = run(validator, ["--input", disclosedPathFile]);
    assert.notEqual(disclosedPathResult.status, 0);
    assert.match(disclosedPathResult.stderr, /controlled_pilot_private_path_disclosed/);
  }

  process.stdout.write(`${JSON.stringify({ status: "passed", negative_case_count: 14 }, null, 2)}\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
