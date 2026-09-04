import fs from "node:fs";
import path from "node:path";
import { CONDITIONS, MODELS, computeAnalysis, digest } from "./scoring.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const fail = (message) => { throw new Error(message); };
const packets = read("03-data/condition-packets-v2.json");
const raw = read("results/raw-pilot.json");
const analysis = read("results/pilot-analysis.json");
if (packets.condition_count !== 36 || packets.conditions.length !== 36) fail("condition_count_invalid");
if (packets.digest !== digest(Object.fromEntries(Object.entries(packets).filter(([key]) => key !== "digest")))) fail("packet_digest_invalid");
if (raw.status !== "complete" || raw.runs.length !== 108 || raw.reviews.length !== 36) fail("pilot_incomplete");
if (raw.failures.some((item) => !item.recovered_at)) fail("active_provider_failure");
if (raw.spent_usd > raw.budget_usd || raw.budget_usd > 5) fail("budget_exceeded");
if (raw.production_effects !== false || raw.canonical_write_allowed !== false) fail("unsafe_boundary");
if (raw.packet_digest !== packets.digest) fail("packet_digest_mismatch");
const expected = new Set(packets.conditions.flatMap((packet) => MODELS.map((model) => `${packet.case_id}:${packet.condition}:${model}`)));
const seen = new Set();
for (const run of raw.runs) { const key = `${run.case_id}:${run.condition}:${run.model}`; if (!expected.has(key) || seen.has(key)) fail(`invalid_run:${key}`); seen.add(key); }
if (seen.size !== expected.size) fail("run_matrix_incomplete");
for (const group of raw.reviews) {
  if (group.reviews.length !== 3 || new Set(group.reviews.map((item) => item.condition)).size !== 3 || CONDITIONS.some((condition) => !group.reviews.some((item) => item.condition === condition))) fail(`review_group_invalid:${group.case_id}:${group.generation_model}`);
  if (!/^sha256:[a-f0-9]{64}$/.test(group.reviewer_input_digest) || !/^sha256:[a-f0-9]{64}$/.test(group.candidate_mapping_digest) || !/^sha256:[a-f0-9]{64}$/.test(group.reviewer_output_digest)) fail("review_audit_binding_invalid");
}
const recomputed = computeAnalysis(packets, raw);
if (JSON.stringify(recomputed) !== JSON.stringify(analysis)) fail("analysis_reconstruction_mismatch");
const serialized = JSON.stringify([packets, raw, analysis]);
for (const pattern of [/BEGIN PRIVATE KEY/, /ghp_[A-Za-z0-9]+/, /github_pat_[A-Za-z0-9_]+/, /sk-[A-Za-z0-9_-]{16,}/]) if (pattern.test(serialized)) fail("sensitive_material");
process.stdout.write(`${JSON.stringify({ valid: true, runs: raw.runs.length, review_groups: raw.reviews.length, spent_usd: raw.spent_usd, analysis_digest: analysis.digest }, null, 2)}\n`);
