#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const pkg = require("../../package.json");
const version = pkg.version;
const report = JSON.parse(fs.readFileSync(path.join(root, `releases/${version}-readiness.json`), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-release-readiness.schema.json"), "utf8"));
const compatibility = JSON.parse(fs.readFileSync(path.join(root, "compat/mirai-graph/package.json"), "utf8"));
const embedding = JSON.parse(fs.readFileSync(path.join(root, "packages/embedding-local/package.json"), "utf8"));
const errors = [];
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(report)) errors.push(...(validate.errors || []).map((item) => `schema:${item.instancePath || "/"}:${item.message}`));
const required = ["gate.2_4_release_boundary", "gate.2_4_local_retrieval", "gate.2_4_independent_conformance", "gate.2_4_security_review", "gate.2_4_multilingual_quality", "gate.2_4_controlled_pilots", "gate.2_4_cross_platform_ci", "gate.2_4_release_metadata", "gate.scientific_claim_boundary"];
const gates = new Map((report.gates || []).map((gate) => [gate.id, gate]));
for (const id of required) if (!gates.has(id)) errors.push(`required_gate_missing:${id}`);
for (const gate of gates.values()) for (const ref of gate.evidence_refs || []) if (!/^[a-z][a-z0-9+.-]*:/i.test(ref) && !fs.existsSync(path.join(root, ref))) errors.push(`${gate.id}:evidence_missing:${ref}`);
const blocking = [...gates.values()].filter((gate) => gate.status !== "passed").map((gate) => gate.id).sort();
if (JSON.stringify(blocking) !== JSON.stringify([...(report.blocking_gate_ids || [])].sort())) errors.push("blocking_gate_ids_mismatch");
if ((blocking.length ? "blocked" : "ready") !== report.overall_status) errors.push("overall_status_mismatch");
if (version !== "2.4.0-alpha.1" || report.evaluated_version !== version || report.promotion_target !== version) errors.push("version_mismatch");
if (compatibility.version !== version || compatibility.dependencies?.["@zabarov/mirai"] !== version) errors.push("compatibility_package_mismatch");
if (embedding.version !== version || !embedding.peerDependencies?.["@zabarov/mirai"]?.includes(version)) errors.push("embedding_package_mismatch");
for (const ref of ["src/retrieval/index.ts", "standard/retrieval-fabric.md", "schemas/retrieval-answer.schema.json", "examples/mirai-retrieval-minimal/results/answer.json"]) if (!fs.existsSync(path.join(root, ref))) errors.push(`retrieval_artifact_missing:${ref}`);
if (process.argv.includes("--require-ready") && report.overall_status !== "ready") errors.push("release_not_ready");
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, release_id: report.release_id, evaluated_version: version, overall_status: report.overall_status, blocking_gate_ids: report.blocking_gate_ids, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
