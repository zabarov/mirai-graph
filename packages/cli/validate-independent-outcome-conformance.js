#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const candidate = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker-2.5-candidate.json"), "utf8"));
const mappings = [
  ["contract", "examples/mirai-outcome-completion-minimal/outcome-contract.json", "conformance/results/python-mirai-2.5-outcome-contract-result.json"],
  ["candidate-set", "examples/mirai-outcome-completion-minimal/candidate-set.json", "conformance/results/python-mirai-2.5-outcome-candidates-result.json"],
  ["assessment", "examples/mirai-outcome-completion-minimal/assessment.json", "conformance/results/python-mirai-2.5-outcome-assessment-result.json"],
  ["aggregate-assessment", "examples/mirai-outcome-completion-minimal/aggregate-assessment.json", "conformance/results/python-mirai-2.5-outcome-aggregate-assessment-result.json"],
  ["delivery-plan", "examples/mirai-outcome-completion-minimal/delivery-plan.json", "conformance/results/python-mirai-2.5-outcome-delivery-result.json"],
  ["pilot-result", "examples/mirai-outcome-pilots/knowledge-assistant-result.json", "conformance/results/python-mirai-2.5-knowledge-assistant-pilot-result.json"],
  ["pilot-result", "examples/mirai-outcome-pilots/federation-project-result.json", "conformance/results/python-mirai-2.5-federation-project-pilot-result.json"],
  ["pilot-result", "examples/mirai-outcome-pilots/ai-employee-result.json", "conformance/results/python-mirai-2.5-ai-employee-pilot-result.json"]
];
const errors = [];
if (!/^[a-f0-9]{40}$/.test(candidate.revision || "")) errors.push("checker_revision_invalid");
if (!/^[a-f0-9]{40}$/.test(candidate.mirai_reference_revision || "")) errors.push("mirai_reference_revision_invalid");
if (candidate.implementation !== "python_independent" || candidate.imports_typescript_runtime !== false) errors.push("checker_independence_invalid");
if (!/^passed_[1-9][0-9]*$/.test(candidate.local_test_status || "")) errors.push("checker_local_tests_not_passed");
if (candidate.canonical_write_performed !== false || candidate.effects_executed !== false) errors.push("checker_safety_boundary_invalid");
for (const [kind, artifactRef, resultRef] of mappings) {
  const artifact = JSON.parse(fs.readFileSync(path.join(root, artifactRef), "utf8"));
  const result = JSON.parse(fs.readFileSync(path.join(root, resultRef), "utf8"));
  if (result.kind !== kind || result.status !== "passed" || result.errors.length) errors.push(`${resultRef}:independent_result_failed`);
  if (result.artifact_digest !== digestValue(artifact)) errors.push(`${resultRef}:artifact_digest_mismatch`);
  if (result.canonical_write_performed !== false || result.effects_executed !== false) errors.push(`${resultRef}:safety_boundary_broken`);
}
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  revision: candidate.revision,
  mirai_reference_revision: candidate.mirai_reference_revision,
  result_count: mappings.length,
  publication_status: candidate.publication_status,
  release_gate_eligible: valid && candidate.release_gate_eligible === true,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
