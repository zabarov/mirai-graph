#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schemas/retrieval-pilot-result.schema.json"), "utf8")));
const domains = ["federation", "larena", "ai_employee", "organization"];
for (const domain of domains) {
  const filename = path.join(root, `pilots/mirai-2.4-retrieval-${domain}/results/pilot-result.json`);
  const value = JSON.parse(fs.readFileSync(filename, "utf8"));
  assert.equal(validate(value), true, `${domain}:${ajv.errorsText(validate.errors)}`);
  const { digest, ...body } = value;
  assert.equal(digestValue(body), digest, `${domain}:digest`);
  assert.ok(value.query_count >= 30, `${domain}:query_count`);
  assert.equal(value.mode, "synthetic_benchmark_slice", `${domain}:evidence_class`);
  assert.equal(value.review.verdict, "synthetic_only", `${domain}:claim_boundary`);
  assert.equal(value.safety.unauthorized_hits, 0, `${domain}:unauthorized_hits`);
  for (const [system, result] of Object.entries(value.systems)) {
    assert.equal(result.unauthorized_hit_count, 0, `${domain}:${system}:unauthorized`);
    assert.equal(result.claim_faithfulness, 1, `${domain}:${system}:faithfulness`);
  }
}
process.stdout.write(`${JSON.stringify({ status: "passed_as_synthetic_slices", slice_count: domains.length, production_effects: 0, canonical_writes: 0, independent_pilot_claim: false }, null, 2)}\n`);
