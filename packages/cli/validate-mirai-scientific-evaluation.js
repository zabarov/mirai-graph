#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const root = path.resolve(__dirname, "../..");

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function validate(ref, schemaRef) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const check = ajv.compile(readJson(schemaRef));
  const document = readJson(ref);
  const errors = [];
  if (!check(document)) errors.push(...(check.errors || []).map((error) => `${error.instancePath || "/"}:${error.message}`));
  return { ref, document, errors };
}

const plan = validate(
  "benchmarks/mirai-2-scientific-evaluation/plan.json",
  "schemas/mirai-scientific-evaluation-plan.schema.json"
);
const power = validate(
  "benchmarks/mirai-2-scientific-evaluation/power-analysis-readiness.json",
  "schemas/mirai-power-analysis-readiness.schema.json"
);
const pilot = validate(
  "benchmarks/mirai-2-scientific-evaluation/variance-pilot-result.json",
  "schemas/mirai-variance-pilot-result.schema.json"
);
const errors = [
  ...plan.errors.map((item) => `plan:${item}`),
  ...power.errors.map((item) => `power:${item}`),
  ...pilot.errors.map((item) => `pilot:${item}`)
];

if (plan.document.study_id !== power.document.study_id) errors.push("study_id_mismatch");
if (plan.document.study_id !== pilot.document.target_study_id) errors.push("pilot_target_study_id_mismatch");
if (plan.document.status === "pilot_variance_pending" && power.document.status !== "insufficient_evidence") {
  errors.push("pending_variance_must_fail_closed");
}
if (plan.document.status === "pilot_variance_complete" && power.document.status !== "ready") {
  errors.push("completed_variance_requires_power_readiness");
}
if (plan.document.status === "pilot_variance_complete" && pilot.document.status !== "exploratory_complete") {
  errors.push("completed_variance_requires_pilot_result");
}
if (pilot.document.review_status !== "independent_human_review_pending") errors.push("pilot_review_status_overclaim");
if (pilot.document.design.observed_cells !== pilot.document.design.expected_cells) errors.push("pilot_cells_incomplete");
if (pilot.document.design.failed_cells !== 0) errors.push("pilot_failed_cells_present");
if (!plan.document.blinding.excluded_from_review_packet.includes("model_class")) errors.push("blinding:model_class_not_excluded");
if (!plan.document.blinding.excluded_from_review_packet.includes("runtime_name")) errors.push("blinding:runtime_name_not_excluded");
if (/outperform|proves improvement|scientifically proven/i.test(plan.document.claim_boundary)) errors.push("claim_boundary:unsupported_claim");

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  study_id: plan.document.study_id,
  pilot_status: pilot.document.status,
  pilot_cells: pilot.document.design.observed_cells,
  readiness: power.document.status,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
