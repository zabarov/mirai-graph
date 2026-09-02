#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const reportRef = "releases/2.1.0-readiness.json";
const report = JSON.parse(fs.readFileSync(path.join(root, reportRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-release-readiness.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const errors = [];
if (!validate(report)) errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));

const required = [
  "gate.2_0_core_security_freeze", "gate.2_1_contract_inventory",
  "gate.2_1_automated_suite", "gate.2_1_cross_implementation_conformance",
  "gate.2_1_controlled_pilots", "gate.independent_security_review",
  "gate.2_1_migration_compatibility", "gate.2_1_clean_room_cross_platform",
  "gate.scientific_claim_boundary", "gate.2_1_stable_release_metadata"
];
const gates = new Map();
for (const gate of report.gates || []) {
  if (gates.has(gate.id)) errors.push(`duplicate_gate:${gate.id}`);
  gates.set(gate.id, gate);
  for (const ref of gate.evidence_refs || []) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    const target = path.resolve(root, ref);
    if (!target.startsWith(`${root}${path.sep}`)) errors.push(`${gate.id}:evidence_outside_repository:${ref}`);
    else if (!fs.existsSync(target)) errors.push(`${gate.id}:evidence_missing:${ref}`);
  }
}
for (const id of required) if (!gates.has(id)) errors.push(`required_gate_missing:${id}`);
const expectedBlocking = [...gates.values()].filter((gate) => gate.status !== "passed").map((gate) => gate.id).sort();
if (JSON.stringify(expectedBlocking) !== JSON.stringify([...(report.blocking_gate_ids || [])].sort())) errors.push("blocking_gate_ids_do_not_match_gate_statuses");
if ((expectedBlocking.length ? "blocked" : "ready") !== report.overall_status) errors.push("overall_status_mismatch");
const packageVersion = require("../../package.json").version;
const numericVersion = (value) => value.split("-")[0].split(".").map(Number);
const [reportMajor, reportMinor, reportPatch] = numericVersion(report.evaluated_version);
const [packageMajor, packageMinor, packagePatch] = numericVersion(packageVersion);
if (packageMajor !== reportMajor || packageMinor < reportMinor || (packageMinor === reportMinor && packagePatch < reportPatch)) errors.push("evaluated_version_newer_than_package");
if (gates.get("gate.scientific_claim_boundary")?.status !== "passed") errors.push("scientific_claim_boundary_must_be_explicit");
if (/scientifically proven|guarantees model independence|unrestricted production/i.test(report.claim_boundary || "")) errors.push("claim_boundary_overclaim");

const counts = { passed: 0, blocked: 0, not_run: 0 };
for (const gate of report.gates || []) counts[gate.status] += 1;
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, release_id: report.release_id, promotion_target: report.promotion_target, overall_status: report.overall_status, counts, blocking_gate_ids: report.blocking_gate_ids, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
