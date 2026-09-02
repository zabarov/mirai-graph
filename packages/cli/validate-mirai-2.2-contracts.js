#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const schemaNames = [
  "source-descriptor.schema.json",
  "source-snapshot.schema.json",
  "data-placement-policy.schema.json",
  "normalized-unit.schema.json",
  "knowledge-proposal.schema.json",
  "process-observation.schema.json",
  "process-candidate.schema.json",
  "autonomy-envelope.schema.json",
  "autonomy-authorization-receipt.schema.json",
  "evolution-proposal.schema.json",
  "evolution-decision.schema.json",
  "promotion-receipt.schema.json",
  "autonomic-cycle.schema.json"
];

function load(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schemas = schemaNames.map((name) => load(`schemas/${name}`));
for (const schema of schemas) ajv.addSchema(schema);
for (const schema of schemas) ajv.getSchema(schema.$id);

const example = "examples/mirai-autonomic-fabric-minimal";
const snapshot = load(`${example}/results/source-snapshot.json`);
const placement = load(`${example}/results/data-placement-policy.json`);
const conversion = load(`${example}/results/conversion-result.json`);
const knowledge = load(`${example}/results/knowledge-proposal.json`);
const observations = load(`${example}/results/process-observations.json`).observations;
const candidates = load(`${example}/results/process-candidates.json`).candidates;
const envelope = load(`${example}/results/autonomy-envelope.json`);
const cycle = load(`${example}/results/autonomic-cycle.json`);

const checks = [
  ["source-snapshot.schema.json", snapshot],
  ["data-placement-policy.schema.json", placement],
  ...conversion.units.map((value) => ["normalized-unit.schema.json", value]),
  ["knowledge-proposal.schema.json", knowledge],
  ...observations.map((value) => ["process-observation.schema.json", value]),
  ...candidates.map((value) => ["process-candidate.schema.json", value]),
  ["autonomy-envelope.schema.json", envelope],
  ["evolution-proposal.schema.json", cycle.evolution_proposal],
  ["evolution-decision.schema.json", cycle.evolution_decision],
  ["autonomic-cycle.schema.json", cycle]
];

const errors = [];
for (const [name, value] of checks) {
  const schema = schemas.find((item) => item.$id.endsWith(`/${name}`));
  const validator = ajv.getSchema(schema.$id);
  if (!validator(value)) errors.push(`${name}:${ajv.errorsText(validator.errors)}`);
}
if (candidates.find((item) => item.mode === "observed")?.technology_draft_allowed !== false) errors.push("observed_process_became_normative");
if (cycle.canonical_write_allowed !== false || cycle.evolution_proposal.canonical_write_allowed !== false) errors.push("canonical_write_boundary_broken");
const publicText = JSON.stringify({ snapshot, conversion, knowledge, observations, candidates, envelope, cycle });
if (/\/Users\/rim\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]|xoxb-|must-not-leak/.test(publicText)) errors.push("public_safety_violation");

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ status: "passed", schema_count: schemas.length, fixture_check_count: checks.length, canonical_write_allowed: false }, null, 2)}\n`);
}
