#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const { digestValue } = require("../../dist/cjs/core");
const root = path.resolve(__dirname, "../../examples/mirai-outcome-pilots");
const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas/outcome-pilot-result.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv); const validate = ajv.compile(schema);
for (const name of ["knowledge-assistant-result.json", "federation-project-result.json", "ai-employee-result.json"]) {
  const value = JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  if (!validate(value)) throw new Error(`${name}:schema:${JSON.stringify(validate.errors)}`);
  const { digest, ...body } = value; if (digest !== digestValue(body)) throw new Error(`${name}:digest_mismatch`);
  if (value.metrics.status_accuracy !== 1) throw new Error(`${name}:status_accuracy`);
  if (Object.values(value.hard_gate_violations).some((count) => count !== 0)) throw new Error(`${name}:hard_gate_violation`);
  if (value.production_effects || value.canonical_write_allowed) throw new Error(`${name}:unsafe_boundary`);
}
process.stdout.write("Mirai 2.5 controlled pilot fixtures: PASS\n");
