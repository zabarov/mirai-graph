#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { inspectProjectForAgent } = require("../../dist/cjs/project");

const root = path.resolve(__dirname, "../..");
const result = JSON.parse(fs.readFileSync(path.join(root, "conformance/results/python-mirai-2.1-project-capsule-result.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "mirai/manifest.lock.json"), "utf8"));
const checker = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker.json"), "utf8"));
const brief = inspectProjectForAgent(root, "project_capsule_conformance");
const errors = [];

if (result.implementation !== "python_independent") errors.push("implementation_mismatch");
if (result.kind !== "mirai_project_capsule") errors.push("kind_mismatch");
if (result.status !== "passed" || result.errors.length !== 0) errors.push("independent_check_not_passed");
if (result.project_lock_digest !== lock.digest) errors.push("project_lock_digest_mismatch");
if (result.agent_brief_digest !== brief.digest) errors.push("agent_brief_digest_mismatch");
if (result.canonical_write_performed !== false) errors.push("canonical_write_boundary_broken");
if (result.effects_executed !== false) errors.push("effect_boundary_broken");
for (const surface of ["project_manifests", "project_locks", "generated_start_pages", "agent_execution_briefs"]) {
  if (!checker.supported_surfaces.includes(surface)) errors.push(`supported_surface_missing:${surface}`);
}

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, implementation: "python_independent", errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
