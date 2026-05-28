#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const writeFlagIndex = process.argv.indexOf("--write");
const outputPath = writeFlagIndex >= 0 ? process.argv[writeFlagIndex + 1] : null;
const metricsPath = path.join(packageRoot, "metrics", "example-metrics.json");
const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));

const baseline = metrics.baseline.estimated_context_units;
const graphContext = metrics.graph_context.estimated_context_units;

if (!Number.isFinite(baseline) || baseline <= 0) {
  throw new Error("baseline.estimated_context_units must be a positive number");
}

if (!Number.isFinite(graphContext) || graphContext < 0) {
  throw new Error("graph_context.estimated_context_units must be a non-negative number");
}

const reductionPercent = ((baseline - graphContext) / baseline) * 100;

const result = {
  schema_version: "0.1.0",
  task_id: metrics.task_id,
  baseline_context_units: baseline,
  graph_context_units: graphContext,
  total_reduction_percent: Number(reductionPercent.toFixed(4)),
  note: "Synthetic demonstration only; do not merge with internal empirical metrics."
};

const output = JSON.stringify(result, null, 2);

if (outputPath) {
  const resolvedOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, `${output}\n`);
}

console.log(output);
