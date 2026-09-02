#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const packageVersion = require("../../package.json").version;
const reportRef = `releases/${packageVersion}-readiness.json`;
const report = JSON.parse(fs.readFileSync(path.join(root, reportRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-release-readiness.schema.json"), "utf8"));
const candidate = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker-2.2-candidate.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const errors = [];
if (!validate(report)) errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));

const required = [
  "gate.2_1_backward_compatibility",
  "gate.2_2_source_converter_contracts",
  "gate.2_2_semantic_process_contracts",
  "gate.2_2_governed_evolution_contracts",
  "gate.2_2_local_independent_conformance",
  "gate.2_2_synthetic_pilots",
  "gate.scientific_claim_boundary",
  "gate.2_2_public_independent_conformance",
  "gate.2_2_connector_integration",
  "gate.2_2_independent_security_review",
  "gate.2_2_cross_platform_clean_room",
  "gate.2_2_controlled_real_pilots",
  "gate.2_2_stable_release_metadata"
];
const gates = new Map();
for (const gate of report.gates || []) {
  if (gates.has(gate.id)) errors.push(`duplicate_gate:${gate.id}`);
  gates.set(gate.id, gate);
  for (const ref of gate.evidence_refs || []) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    const target = path.resolve(root, ref);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) errors.push(`${gate.id}:evidence_outside_repository:${ref}`);
    else if (!fs.existsSync(target)) errors.push(`${gate.id}:evidence_missing:${ref}`);
  }
}
for (const id of required) if (!gates.has(id)) errors.push(`required_gate_missing:${id}`);

const expectedBlocking = [...gates.values()].filter((gate) => gate.status !== "passed").map((gate) => gate.id).sort();
const declaredBlocking = [...(report.blocking_gate_ids || [])].sort();
if (JSON.stringify(expectedBlocking) !== JSON.stringify(declaredBlocking)) errors.push("blocking_gate_ids_do_not_match_gate_statuses");
if ((expectedBlocking.length ? "blocked" : "ready") !== report.overall_status) errors.push("overall_status_mismatch");
if (report.evaluated_version !== packageVersion) errors.push("evaluated_version_package_mismatch");
if (report.promotion_target !== "2.2.0" || !/^2\.2\.0(?:-[0-9A-Za-z.-]+)?$/.test(report.evaluated_version)) errors.push("stable_promotion_target_required");
if (candidate.release_gate_eligible !== false) errors.push("local_checker_candidate_must_not_be_release_gate_eligible");
if (gates.get("gate.2_2_public_independent_conformance")?.status === "passed") errors.push("public_conformance_cannot_pass_for_local_candidate");
if (gates.get("gate.scientific_claim_boundary")?.status !== "passed") errors.push("scientific_claim_boundary_must_be_explicit");
if (/scientifically proven|guarantees correctness|unrestricted autonomy/i.test(report.claim_boundary || "")) errors.push("claim_boundary_overclaim");
if (/\/Users\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(JSON.stringify(report))) errors.push("public_safety_violation");

const counts = { passed: 0, blocked: 0, not_run: 0 };
for (const gate of report.gates || []) counts[gate.status] += 1;
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, release_id: report.release_id, promotion_target: report.promotion_target, overall_status: report.overall_status, counts, blocking_gate_ids: report.blocking_gate_ids, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
