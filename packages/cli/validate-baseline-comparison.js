#!/usr/bin/env node

const fs = require("fs");

const resultPath = process.argv[2] || "benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requireString(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} must be a non-empty string`);
  }
}

function requireNumber(value, label, errors) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${label} must be a number`);
  }
}

const errors = [];
const result = readJson(resultPath);

requireString(result.schema_version, "schema_version", errors);
requireString(result.id, "id", errors);
requireString(result.task_id, "task_id", errors);
if (result.public_safety !== "synthetic_public") {
  errors.push("public_safety must be synthetic_public");
}
if (result.comparison_type !== "baseline_vs_growgraph") {
  errors.push("comparison_type must be baseline_vs_growgraph");
}

for (const side of ["baseline", "growgraph"]) {
  const metrics = result[side];
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    errors.push(`${side} must be an object`);
    continue;
  }
  for (const field of [
    "context_units",
    "missed_dependencies",
    "unsupported_assumptions",
    "evidence_coverage_percent",
    "false_progress_claims"
  ]) {
    requireNumber(metrics[field], `${side}.${field}`, errors);
  }
}

if (!result.outcome || typeof result.outcome !== "object" || Array.isArray(result.outcome)) {
  errors.push("outcome must be an object");
} else {
  requireNumber(result.outcome.context_reduction_percent, "outcome.context_reduction_percent", errors);
  if (!Array.isArray(result.outcome.improved_metrics) || result.outcome.improved_metrics.length === 0) {
    errors.push("outcome.improved_metrics must be a non-empty array");
  }
  if (!Array.isArray(result.outcome.regressed_metrics)) {
    errors.push("outcome.regressed_metrics must be an array");
  }
  requireString(result.outcome.verdict, "outcome.verdict", errors);
}

if (
  result.baseline &&
  result.growgraph &&
  typeof result.baseline.context_units === "number" &&
  typeof result.growgraph.context_units === "number" &&
  result.growgraph.context_units > result.baseline.context_units
) {
  errors.push("growgraph.context_units must not exceed baseline.context_units for this fixture");
}

if (
  result.baseline &&
  result.growgraph &&
  typeof result.growgraph.evidence_coverage_percent === "number" &&
  typeof result.baseline.evidence_coverage_percent === "number" &&
  result.growgraph.evidence_coverage_percent < result.baseline.evidence_coverage_percent
) {
  errors.push("growgraph.evidence_coverage_percent must not be lower than baseline for this fixture");
}

if (!Array.isArray(result.limitations) || result.limitations.length === 0) {
  errors.push("limitations must be a non-empty array");
}

if (
  typeof result.claim_boundary !== "string" ||
  !result.claim_boundary.toLowerCase().includes("synthetic")
) {
  errors.push("claim_boundary must explicitly keep the claim synthetic");
}

const output = {
  mode: "baseline_comparison_result",
  target: resultPath,
  valid: errors.length === 0,
  errors
};

console.log(JSON.stringify(output, null, 2));
process.exit(output.valid ? 0 : 1);

