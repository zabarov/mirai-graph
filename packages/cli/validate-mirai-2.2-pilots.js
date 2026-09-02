#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue, withoutDigest } = require("../../dist/cjs/core");
const { planAutonomicCycle } = require("../../dist/cjs/evolution");

const root = path.resolve(__dirname, "../..");
const names = ["self-hosting", "federation", "modular-software", "ai-employee"];
const errors = [];
for (const name of names) {
  const directory = path.join(root, `pilots/mirai-2.2-${name}-autonomic`);
  const input = JSON.parse(fs.readFileSync(path.join(directory, "pilot-input.json"), "utf8"));
  const report = JSON.parse(fs.readFileSync(path.join(directory, "pilot-result.json"), "utf8"));
  const cycle = planAutonomicCycle(input);
  if (cycle.digest !== report.evidence.cycle_digest) errors.push(`${name}:cycle_digest_mismatch`);
  if (digestValue(withoutDigest(report)) !== report.digest) errors.push(`${name}:report_digest_mismatch`);
  if (report.production_effects !== false || report.canonical_write_allowed !== false) errors.push(`${name}:safety_boundary_invalid`);
  if (cycle.processes.intended_count !== 1 || cycle.processes.observed_count !== 1) errors.push(`${name}:process_separation_missing`);
  if (cycle.processes.candidates.find((item) => item.mode === "observed")?.technology_draft_allowed !== false) errors.push(`${name}:observed_process_promoted`);
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ status: "passed", pilot_count: names.length, independent_human_review: "pending", production_effects: false }, null, 2)}\n`);
}
