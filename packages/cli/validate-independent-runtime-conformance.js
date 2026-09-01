#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const root = path.resolve(__dirname, "../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-independent-artifact-result.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const fixtures = [
  {
    result: "conformance/results/python-federation-episode-result.json",
    type: "pure_episode",
    source: "pilots/mirai-2-beta-federation/results/episode.json",
    requiredChecks: ["schema", "digest_recalculation", "trace_sequence", "effect_boundary", "program_binding"]
  },
  {
    result: "conformance/results/python-ai-employee-episode-result.json",
    type: "pure_episode",
    source: "pilots/mirai-2-beta-ai-employee/results/episode.json",
    requiredChecks: ["schema", "digest_recalculation", "trace_sequence", "effect_boundary", "program_binding"]
  },
  {
    result: "conformance/results/python-larena-runtime-evidence-result.json",
    type: "sanitized_runtime_evidence",
    source: "pilots/mirai-2-beta-larena/results/mirai-evidence.json",
    requiredChecks: ["schema", "public_export_boundary", "receipt_sequence", "receipt_summary_consistency", "canonical_and_learning_boundary"]
  }
];

function insideRepository(ref) {
  const target = path.resolve(root, ref);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function validateFixture(fixture) {
  const errors = [];
  const resultPath = path.join(root, fixture.result);
  if (!fs.existsSync(resultPath)) return { result: fixture.result, valid: false, errors: ["result_missing"] };
  const document = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  if (!validate(document)) {
    errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
  }
  if (document.status !== "passed" || document.errors?.length !== 0) errors.push("independent_result_not_passed");
  if (document.artifact_type !== fixture.type) errors.push("artifact_type_mismatch");
  if (document.source_ref !== fixture.source) errors.push("source_ref_mismatch");
  for (const check of fixture.requiredChecks) {
    if (!document.checks?.includes(check)) errors.push(`required_check_missing:${check}`);
  }
  for (const ref of [document.source_ref, document.schema_ref, document.program_ref].filter(Boolean)) {
    if (!insideRepository(ref)) errors.push(`reference_outside_repository:${ref}`);
    else if (!fs.existsSync(path.resolve(root, ref))) errors.push(`reference_missing:${ref}`);
  }
  return { result: fixture.result, valid: errors.length === 0, errors };
}

const results = fixtures.map(validateFixture);
const valid = results.every((item) => item.valid);
process.stdout.write(`${JSON.stringify({ valid, implementation: "python_independent", results }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
