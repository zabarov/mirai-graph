#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");
const root = path.resolve(__dirname, "../..");
const report = JSON.parse(fs.readFileSync(path.join(root, "releases/2.5.0-rc.1-readiness.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-release-readiness.schema.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const errors = [];
const ajv = new Ajv2020({allErrors: true, strict: false});
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(report)) errors.push(...(validate.errors || []).map((item) => `schema:${item.instancePath || "/"}:${item.message}`));
const required = ["gate.2_5_architecture_boundary", "gate.2_5_local_contracts", "gate.2_5_package_compatibility", "gate.2_5_controlled_pilot", "gate.2_5_independent_conformance", "gate.2_5_security_review", "gate.2_5_cross_platform_ci", "gate.2_5_release_metadata", "gate.scientific_claim_boundary"];
const gates = new Map((report.gates || []).map((gate) => [gate.id, gate]));
for (const id of required) if (!gates.has(id)) errors.push(`required_gate_missing:${id}`);
for (const gate of gates.values()) for (const ref of gate.evidence_refs || []) if (!/^[a-z][a-z0-9+.-]*:/i.test(ref) && !fs.existsSync(path.join(root, ref))) errors.push(`${gate.id}:evidence_missing:${ref}`);
const blocking = [...gates.values()].filter((gate) => gate.status !== "passed").map((gate) => gate.id).sort();
if (JSON.stringify(blocking) !== JSON.stringify([...(report.blocking_gate_ids || [])].sort())) errors.push("blocking_gate_ids_mismatch");
if ((blocking.length ? "blocked" : "ready") !== report.overall_status) errors.push("overall_status_mismatch");
if (report.evaluated_version !== "2.5.0-rc.1" || report.promotion_target !== "2.5.0-rc.1") errors.push("readiness_version_mismatch");
if (!/^2\.5\.0-(?:alpha\.1|rc\.1)$/.test(pkg.version)) errors.push("package_candidate_version_invalid");
if (process.argv.includes("--require-ready")) {
  if (report.overall_status !== "ready") errors.push("release_not_ready");
  if (pkg.version !== "2.5.0-rc.1") errors.push("rc_package_version_not_set");
}
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({valid, release_id: report.release_id, package_version: pkg.version, overall_status: report.overall_status, blocking_gate_ids: report.blocking_gate_ids, errors}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
