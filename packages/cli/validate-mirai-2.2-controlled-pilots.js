#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue, withoutDigest } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const target = path.join(root, "pilots/mirai-2.2-controlled-observe/pilot-result.json");
const report = JSON.parse(fs.readFileSync(target, "utf8"));
const errors = [];
const expectedIds = ["pilot.controlled.ai-employee", "pilot.controlled.federation", "pilot.controlled.modular-software", "pilot.controlled.self-hosting"];
if (report.contract_version !== "1.0.0" || report.release_target !== "2.2.0") errors.push("controlled_pilot_contract_invalid");
if (report.status !== "controlled_observe_complete" || report.case_count !== 4) errors.push("controlled_pilot_suite_incomplete");
if ((report.results || []).map((item) => item.id).sort().join(",") !== expectedIds.join(",")) errors.push("controlled_pilot_case_set_invalid");
if (report.production_effects !== false || report.canonical_write_allowed !== false) errors.push("controlled_pilot_boundary_invalid");
if (digestValue(withoutDigest(report)) !== report.digest) errors.push("controlled_pilot_report_digest_mismatch");
for (const result of report.results || []) {
  if (result.source_kind !== "real_repository_subset" || result.mode !== "observe_suggest") errors.push(`${result.id}:not_real_observe_pilot`);
  if (result.source_item_count < 1 || result.normalized_unit_count < 1) errors.push(`${result.id}:source_evidence_missing`);
  if (result.production_effects !== false || result.canonical_write_allowed !== false || result.protected_or_effectful_change_applied !== false) errors.push(`${result.id}:safety_boundary_invalid`);
  if (result.raw_paths_disclosed !== false || result.raw_content_disclosed !== false) errors.push(`${result.id}:public_safety_invalid`);
  if (result.technology_draft_allowed_count !== 0) errors.push(`${result.id}:observed_practice_promoted`);
  if (digestValue(withoutDigest(result)) !== result.digest) errors.push(`${result.id}:digest_mismatch`);
}
const serialized = JSON.stringify(report);
if (/\/Users\/|\\Users\\|larena|simai|ai-codex/i.test(serialized)) errors.push("controlled_pilot_private_identifier_disclosed");
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ valid: true, case_count: report.case_count, mode: "observe_suggest", production_effects: false, independent_review: report.independent_review }, null, 2)}\n`);
}
