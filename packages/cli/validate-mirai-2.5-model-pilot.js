#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const pilotRoot = path.join(root, "pilots/mirai-2.5-controlled-model");
const read = (name) => JSON.parse(fs.readFileSync(path.join(pilotRoot, name), "utf8"));
const digest = (value) => `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const errors = [];
const packets = read("data/condition-packets-v1.json");
const raw = read("results/raw-pilot.json");
const analysis = read("results/pilot-analysis.json");

if (packets.condition_count !== 36 || packets.conditions.length !== 36) errors.push("condition_count_invalid");
if (raw.status !== "complete") errors.push(`raw_status:${raw.status}`);
if (raw.runs.length !== 108) errors.push(`run_count:${raw.runs.length}`);
if (raw.reviews.length !== 36) errors.push(`review_group_count:${raw.reviews.length}`);
if (raw.failures.some((item) => !item.recovered_at)) errors.push("active_provider_failure");
if (raw.spent_usd > 5) errors.push(`budget_exceeded:${raw.spent_usd}`);
if (raw.production_effects !== false || raw.canonical_write_allowed !== false) errors.push("unsafe_raw_boundary");
if (raw.packet_digest !== packets.digest) errors.push("packet_digest_mismatch");
if (analysis.raw_digest !== digest(raw)) errors.push("raw_digest_mismatch");
if (analysis.run_count !== 108 || analysis.review_group_count !== 36) errors.push("analysis_counts_invalid");
if (analysis.active_failure_count !== 0) errors.push("analysis_provider_failure");
if (analysis.release_gate_recommendation !== "eligible_for_rc_engineering_review") errors.push("recommendation_invalid");
if (analysis.production_effects !== false || analysis.canonical_write_allowed !== false) errors.push("unsafe_analysis_boundary");

const runKeys = new Set();
for (const run of raw.runs) {
  const key = `${run.case_id}:${run.condition}:${run.model}`;
  if (runKeys.has(key)) errors.push(`duplicate_run:${key}`);
  runKeys.add(key);
}

const serialized = [packets, raw, analysis].map(JSON.stringify).join("\n");
for (const pattern of [/BEGIN PRIVATE KEY/, /ghp_[A-Za-z0-9]+/, /github_pat_[A-Za-z0-9_]+/, /sk-[A-Za-z0-9_-]{16,}/]) {
  if (pattern.test(serialized)) errors.push(`sensitive_material:${pattern}`);
}

const result = {
  valid: errors.length === 0,
  runs: raw.runs.length,
  review_groups: raw.reviews.length,
  provider_cost_usd: raw.spent_usd,
  packet_digest: raw.packet_digest,
  analysis_digest: analysis.digest,
  errors
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.valid ? 0 : 1;
