#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const exampleDir = path.join("examples", "federation-routing-smoke");
const requiredFiles = [
  "routing-fixtures.json",
  "routing-fixture-run.json",
  "route-explanation.json",
  "route-regression-result.json",
  "federation-health-dashboard.json"
];

const errors = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: cannot read JSON: ${error.message}`);
    return null;
  }
}

for (const fileName of requiredFiles) {
  const file = path.join(exampleDir, fileName);
  if (!fs.existsSync(file)) {
    errors.push(`${file}: missing`);
  }
}

const fixtures = readJson(path.join(exampleDir, "routing-fixtures.json"));
const run = readJson(path.join(exampleDir, "routing-fixture-run.json"));
const explanation = readJson(path.join(exampleDir, "route-explanation.json"));
const regression = readJson(path.join(exampleDir, "route-regression-result.json"));
const health = readJson(path.join(exampleDir, "federation-health-dashboard.json"));

if (fixtures) {
  if (fixtures.canonical_write_allowed !== false) errors.push("routing-fixtures.json: canonical_write_allowed must be false");
  if (!Array.isArray(fixtures.fixtures) || fixtures.fixtures.length < 2) errors.push("routing-fixtures.json: must include at least two synthetic fixtures");
}

if (run) {
  if (run.canonical_write_allowed !== false) errors.push("routing-fixture-run.json: canonical_write_allowed must be false");
  if (!run.summary || run.summary.fixture_count !== 2 || run.summary.passed !== 2) errors.push("routing-fixture-run.json: expected two passing fixtures");
  for (const result of run.results || []) {
    if (!result.execution_evidence_ref) errors.push(`${result.fixture_id}: execution_evidence_ref is required`);
    if (!result.route_result_ref) errors.push(`${result.fixture_id}: route_result_ref is required`);
    if (result.high_risk_route && !result.route_explanation_ref) errors.push(`${result.fixture_id}: high-risk route requires route_explanation_ref`);
  }
}

if (explanation) {
  if (explanation.canonical_write_allowed !== false) errors.push("route-explanation.json: canonical_write_allowed must be false");
  if (!explanation.route_evidence_ref) errors.push("route-explanation.json: route_evidence_ref is required");
  if (explanation.explanation_source !== "synthetic_example") errors.push("route-explanation.json: explanation_source must be synthetic_example");
}

if (regression) {
  if (regression.regression_status !== "unchanged") errors.push("route-regression-result.json: regression_status must be unchanged");
  if (regression.canonical_write_allowed !== false) errors.push("route-regression-result.json: canonical_write_allowed must be false");
}

if (health) {
  if (health.watch_conflict_count < 1) errors.push("federation-health-dashboard.json: watch_conflict_count should expose watched conflict families");
  if (health.high_risk_without_explanation_count !== 0) errors.push("federation-health-dashboard.json: high_risk_without_explanation_count must be zero");
  if (health.canonical_write_allowed !== false) errors.push("federation-health-dashboard.json: canonical_write_allowed must be false");
}

const output = {
  mode: "routing_control_examples",
  valid: errors.length === 0,
  checked_files: requiredFiles.map((fileName) => path.join(exampleDir, fileName)),
  errors
};

console.log(JSON.stringify(output, null, 2));
process.exit(output.valid ? 0 : 1);
