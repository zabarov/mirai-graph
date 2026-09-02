#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const root = path.resolve(__dirname, "../..");
const targetRef = "releases/2.1.0-contract-freeze-candidate.json";
const value = JSON.parse(fs.readFileSync(path.join(root, targetRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-contract-freeze-candidate.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const errors = [];
if (!validate(value)) errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));

const required = [
  "mirai.graph_core", "mirai.program", "mirai.runtime", "mirai.authorization",
  "mirai.conformance", "mirai.assimilation", "mirai.components",
  "mirai.technology", "mirai.activation", "mirai.shadow_differential",
  "mirai.project", "mirai.project_technology"
];
const ids = new Set();
for (const surface of value.surfaces || []) {
  if (ids.has(surface.id)) errors.push(`duplicate_surface:${surface.id}`);
  ids.add(surface.id);
  if (surface.stability !== "freeze_candidate") errors.push(`surface_not_freeze_candidate:${surface.id}`);
  for (const ref of surface.schema_refs || []) {
    const resolved = path.resolve(root, ref);
    if (!resolved.startsWith(`${root}${path.sep}`)) errors.push(`${surface.id}:schema_outside_repository:${ref}`);
    else if (!fs.existsSync(resolved)) errors.push(`${surface.id}:schema_missing:${ref}`);
    else JSON.parse(fs.readFileSync(resolved, "utf8"));
  }
}
for (const id of required) if (!ids.has(id)) errors.push(`required_surface_missing:${id}`);
if (/guarantees|scientifically proven|unrestricted production/i.test(value.claim_boundary || "")) errors.push("claim_boundary_overclaim");

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, target: targetRef, baseline_commit: value.baseline_commit, surface_count: (value.surfaces || []).length, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
