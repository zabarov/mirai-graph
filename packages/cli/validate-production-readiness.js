#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const root = path.resolve(__dirname, "../..");
const targetRef = process.argv[2] || "examples/production-readiness-minimal/production-readiness.json";

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.resolve(root, ref), "utf8"));
}

function checkRef(ref, errors, label) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return;
  const resolved = path.resolve(root, ref);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    errors.push(`${label}:outside_repository:${ref}`);
  } else if (!fs.existsSync(resolved)) {
    errors.push(`${label}:missing:${ref}`);
  }
}

const value = readJson(targetRef);
const schema = readJson("schemas/mirai-production-readiness-profile.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const errors = [];

if (!validate(value)) {
  errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
}

const contractIds = new Set();
for (const contract of value.contracts || []) {
  if (contractIds.has(contract.id)) errors.push(`duplicate_contract:${contract.id}`);
  contractIds.add(contract.id);
  for (const ref of contract.evidence_refs || []) checkRef(ref, errors, `contract:${contract.id}`);
}
for (const [key, ref] of Object.entries(value.controls || {})) {
  if (key.endsWith("_ref")) checkRef(ref, errors, `control:${key}`);
}
for (const [kind, review] of Object.entries(value.external_reviews || {})) {
  for (const ref of review.evidence_refs || []) checkRef(ref, errors, `review:${kind}`);
  if (review.status === "passed" && review.reviewer_independent !== true) {
    errors.push(`review:${kind}:passed_without_independent_reviewer`);
  }
}

if (value.evaluated_tier === "production_write" && value.verdict === "ready") {
  for (const kind of ["security", "human"]) {
    const review = value.external_reviews?.[kind];
    if (review?.status !== "passed" || review?.reviewer_independent !== true) {
      errors.push(`production_write_requires_independent_${kind}_review`);
    }
  }
  if ((value.contracts || []).some((contract) => contract.status !== "stable")) {
    errors.push("production_write_requires_stable_contracts");
  }
}

if (["production_read", "production_write"].includes(value.evaluated_tier)) {
  if ((value.runtime_composition?.registered_effects || []).includes("process_run")) {
    errors.push("production_composition_cannot_register_process_run");
  }
  if ((value.runtime_composition?.registered_adapters || []).includes("test")) {
    errors.push("production_composition_cannot_register_test_adapter");
  }
}

if (value.canonical_write_allowed !== false) errors.push("readiness_profile_cannot_authorize_canonical_write");
if (/guarantees|scientifically proven|unrestricted production/i.test(value.claim_boundary || "")) {
  errors.push("claim_boundary_overclaim");
}

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  target: targetRef,
  evaluated_tier: value.evaluated_tier,
  verdict: value.verdict,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
