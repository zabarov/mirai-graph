#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const fixtures = [
  {
    result: "conformance/results/python-mirai-2.1-activation-plan-result.json",
    artifact: "pilots/mirai-2.1-beta-federation/results/activation-plan.json",
    kind: "activation-plan"
  },
  {
    result: "conformance/results/python-mirai-2.1-activation-run-result.json",
    artifact: "pilots/mirai-2.1-beta-federation/results/activation-run-result.json",
    kind: "activation-run-result"
  }
];

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

const results = fixtures.map((fixture) => {
  const errors = [];
  const document = readJson(fixture.result);
  const artifact = readJson(fixture.artifact);
  if (document.implementation !== "python_independent") errors.push("implementation_mismatch");
  if (document.kind !== fixture.kind) errors.push("kind_mismatch");
  if (document.status !== "passed" || document.errors.length !== 0) errors.push("independent_check_not_passed");
  if (document.artifact_digest !== digestValue(artifact)) errors.push("artifact_digest_mismatch");
  if (document.canonical_write_performed !== false) errors.push("canonical_write_boundary_broken");
  if (document.effects_executed !== false) errors.push("effect_boundary_broken");
  return { result: fixture.result, valid: errors.length === 0, errors };
});

const checker = readJson("conformance/independent-checker.json");
if (!/^[a-f0-9]{40}$/.test(checker.checker.revision)) results.push({ result: "conformance/independent-checker.json", valid: false, errors: ["checker_revision_invalid"] });
for (const surface of ["activation_plans", "activation_run_results"]) {
  if (!checker.supported_surfaces.includes(surface)) results.push({ result: "conformance/independent-checker.json", valid: false, errors: [`supported_surface_missing:${surface}`] });
}

const valid = results.every((item) => item.valid);
process.stdout.write(`${JSON.stringify({ valid, implementation: "python_independent", results }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
