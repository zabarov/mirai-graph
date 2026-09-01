#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const reportRef = "releases/2.0.0-readiness.json";
const schemaRef = "schemas/mirai-release-readiness.schema.json";
const requiredGateIds = [
  "gate.automated_test_suite",
  "gate.property_fuzz_suite",
  "gate.cross_implementation_conformance",
  "gate.controlled_engineering_pilots",
  "gate.zero_unauthorized_effects",
  "gate.zero_false_acceptance",
  "gate.zero_duplicate_verified_effects",
  "gate.migration_compatibility",
  "gate.clean_room_local_install",
  "gate.cross_platform_ci_evidence",
  "gate.blinded_independent_human_review",
  "gate.comparable_variance_pilot",
  "gate.power_analysis",
  "gate.confirmatory_factorial_evaluation",
  "gate.independent_security_review",
  "gate.public_independent_checker",
  "gate.stable_release_metadata"
];

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function resolveEvidence(ref, errors, gateId) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return;
  const target = path.resolve(root, ref);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    errors.push(`${gateId}:evidence_outside_repository:${ref}`);
  } else if (!fs.existsSync(target)) {
    errors.push(`${gateId}:evidence_missing:${ref}`);
  }
}

const report = readJson(reportRef);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const check = ajv.compile(readJson(schemaRef));
const errors = [];
if (!check(report)) {
  errors.push(...(check.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
}

const gateById = new Map();
for (const gate of report.gates || []) {
  if (gateById.has(gate.id)) errors.push(`duplicate_gate:${gate.id}`);
  gateById.set(gate.id, gate);
  for (const ref of gate.evidence_refs || []) resolveEvidence(ref, errors, gate.id);
}
for (const gateId of requiredGateIds) if (!gateById.has(gateId)) errors.push(`required_gate_missing:${gateId}`);

const expectedBlocking = [...gateById.values()]
  .filter((gate) => gate.status !== "passed")
  .map((gate) => gate.id)
  .sort();
const declaredBlocking = [...(report.blocking_gate_ids || [])].sort();
if (JSON.stringify(expectedBlocking) !== JSON.stringify(declaredBlocking)) errors.push("blocking_gate_ids_do_not_match_gate_statuses");
if (expectedBlocking.length > 0 && report.overall_status !== "blocked") errors.push("overall_status_must_be_blocked");
if (expectedBlocking.length === 0 && report.overall_status !== "ready") errors.push("overall_status_must_be_ready");
if (report.evaluated_version !== require("../../package.json").version) errors.push("evaluated_version_package_mismatch");
if (/proves|scientifically proven|guarantees model independence/i.test(report.claim_boundary || "")) errors.push("claim_boundary_overclaim");

const serialized = JSON.stringify(report);
if (/\/Users\/rim\/Documents\/GitHub\/(?:ai-codex|larena|bx-simai|science)|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(serialized)) {
  errors.push("public_safety_violation");
}

const counts = { passed: 0, blocked: 0, not_run: 0 };
for (const gate of report.gates || []) counts[gate.status] += 1;
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  release_id: report.release_id,
  evaluated_version: report.evaluated_version,
  overall_status: report.overall_status,
  counts,
  blocking_gate_ids: report.blocking_gate_ids,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
