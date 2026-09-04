#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const historicalVersion = "2.3.0-alpha.1";
const currentVersion = require("../../package.json").version;
const reportRef = `releases/${historicalVersion}-readiness.json`;
const report = JSON.parse(fs.readFileSync(path.join(root, reportRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-release-readiness.schema.json"), "utf8"));
const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const codeql = fs.readFileSync(path.join(root, ".github/workflows/codeql.yml"), "utf8");
const errors = [];
const check = new Ajv2020({ allErrors: true, strict: false });
addFormats(check);
const validate = check.compile(schema);
if (!validate(report)) errors.push(...(validate.errors || []).map(error => `schema:${error.instancePath || "/"}:${error.message}`));

const required = [
  "gate.2_3_release_boundary",
  "gate.2_3_graph_operations",
  "gate.2_3_task_delegation",
  "gate.2_3_independent_conformance",
  "gate.2_3_security_review",
  "gate.2_3_cross_platform_ci",
  "gate.2_3_release_metadata",
  "gate.scientific_claim_boundary"
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
const expectedBlocking = [...gates.values()].filter(gate => gate.status !== "passed").map(gate => gate.id).sort();
if (JSON.stringify(expectedBlocking) !== JSON.stringify([...(report.blocking_gate_ids || [])].sort())) errors.push("blocking_gate_ids_do_not_match_gate_statuses");
if ((expectedBlocking.length ? "blocked" : "ready") !== report.overall_status) errors.push("overall_status_mismatch");
if (report.evaluated_version !== historicalVersion || report.promotion_target !== historicalVersion) errors.push("historical_version_mismatch");
if (!fs.existsSync(path.join(root, `releases/${historicalVersion}.md`))) errors.push("release_note_missing");
if (!ci.includes("codex/mirai-2.3") || !ci.includes("npm run test:mirai-2.3")) errors.push("mirai_2_3_ci_missing");
if (!codeql.includes("codex/mirai-2.3")) errors.push("mirai_2_3_codeql_missing");
if (/scientifically proven|guarantees correctness|\bis production-write ready\b|\bpermits unrestricted autonomy\b/i.test(report.claim_boundary || "")) errors.push("claim_boundary_overclaim");
if (/\/Users\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\b(?:ghp_|sk-proj-|xoxb-)[A-Za-z0-9_-]{8,}|raw \.env/.test(JSON.stringify(report))) errors.push("public_safety_violation");
if (process.argv.includes("--require-ready") && report.overall_status !== "ready") errors.push("release_not_ready");

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, release_id: report.release_id, evaluated_version: historicalVersion, current_version: currentVersion,
  overall_status: report.overall_status, blocking_gate_ids: report.blocking_gate_ids, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
