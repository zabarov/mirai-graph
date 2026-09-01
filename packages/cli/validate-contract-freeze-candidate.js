#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const root = path.resolve(__dirname, "../..");
const targetRef = "releases/2.0.0-contract-freeze-candidate.json";
const value = JSON.parse(fs.readFileSync(path.join(root, targetRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-contract-freeze-candidate.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const errors = [];

if (!validate(value)) {
  errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
}

const ids = new Set();
for (const surface of value.surfaces || []) {
  if (ids.has(surface.id)) errors.push(`duplicate_surface:${surface.id}`);
  ids.add(surface.id);
  for (const ref of surface.schema_refs || []) {
    const resolved = path.resolve(root, ref);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) errors.push(`${surface.id}:schema_outside_repository:${ref}`);
    else if (!fs.existsSync(resolved)) errors.push(`${surface.id}:schema_missing:${ref}`);
  }
}

for (const required of ["mirai.program", "mirai.runtime", "mirai.capability"]) {
  const surface = (value.surfaces || []).find((candidate) => candidate.id === required);
  if (!surface) errors.push(`required_surface_missing:${required}`);
  else if (surface.product_line !== "2.0" || surface.stability !== "freeze_candidate") {
    errors.push(`base_surface_not_freeze_candidate:${required}`);
  }
}
for (const surface of value.surfaces || []) {
  if (surface.product_line === "2.1" && surface.stability !== "draft") {
    errors.push(`additive_2_1_surface_must_remain_draft:${surface.id}`);
  }
}

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  target: targetRef,
  status: value.status,
  surface_count: (value.surfaces || []).length,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
