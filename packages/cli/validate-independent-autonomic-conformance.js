#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const candidate = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker-2.2-candidate.json"), "utf8"));
const mappings = [
  ["source-snapshot", "examples/mirai-autonomic-fabric-minimal/results/source-snapshot.json", "conformance/results/python-mirai-2.2-source-snapshot-result.json"],
  ["knowledge-proposal", "examples/mirai-autonomic-fabric-minimal/results/knowledge-proposal.json", "conformance/results/python-mirai-2.2-knowledge-proposal-result.json"],
  ["autonomy-envelope", "examples/mirai-autonomic-fabric-minimal/results/autonomy-envelope.json", "conformance/results/python-mirai-2.2-autonomy-envelope-result.json"],
  ["evolution-decision", "examples/mirai-autonomic-fabric-minimal/results/evolution-decision.json", "conformance/results/python-mirai-2.2-evolution-decision-result.json"],
  ["autonomic-cycle", "examples/mirai-autonomic-fabric-minimal/results/autonomic-cycle.json", "conformance/results/python-mirai-2.2-autonomic-cycle-result.json"]
];
const errors = [];
if (!/^[a-f0-9]{40}$/.test(candidate.revision || "")) errors.push("checker_revision_invalid");
if (candidate.implementation !== "python_independent" || candidate.imports_typescript_runtime !== false) errors.push("checker_independence_invalid");
if (candidate.local_test_status !== "passed_22") errors.push("checker_local_tests_not_passed");
if (candidate.canonical_write_performed !== false || candidate.effects_executed !== false) errors.push("checker_safety_boundary_invalid");
for (const [kind, artifactRef, resultRef] of mappings) {
  const artifact = JSON.parse(fs.readFileSync(path.join(root, artifactRef), "utf8"));
  const result = JSON.parse(fs.readFileSync(path.join(root, resultRef), "utf8"));
  if (result.kind !== kind || result.status !== "passed" || result.errors.length) errors.push(`${kind}:independent_result_failed`);
  if (result.artifact_digest !== digestValue(artifact)) errors.push(`${kind}:artifact_digest_mismatch`);
  if (result.canonical_write_performed !== false || result.effects_executed !== false) errors.push(`${kind}:safety_boundary_broken`);
}
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, revision: candidate.revision, result_count: mappings.length, publication_status: candidate.publication_status, release_gate_eligible: valid && candidate.release_gate_eligible === true, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
