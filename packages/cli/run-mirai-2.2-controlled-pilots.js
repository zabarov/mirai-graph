#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { digestValue } = require("../../dist/cjs/core");
const { organizeKnowledge } = require("../../dist/cjs/knowledge");
const { buildSourceSnapshot, convertPayloads, createFilesystemSourceProvider, DEFAULT_SOURCE_BUDGET } = require("../../dist/cjs/sources");
const { observationsFromUnits } = require("../../dist/cjs/technology");
const { planAutonomicCycle } = require("../../dist/cjs/evolution");

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const configPath = option("--config");
const outputPath = option("--out");
if (!configPath || !outputPath) {
  process.stderr.write("Usage: run-mirai-2.2-controlled-pilots.js --config <local-config.json> --out <sanitized-result.json>\n");
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf8"));
if (config.contract_version !== "1.0.0" || !Array.isArray(config.cases) || config.cases.length !== 4) throw new Error("controlled_pilot_config_invalid");
const expectedIds = ["ai-employee", "federation", "modular-software", "self-hosting"];
if (config.cases.map((item) => item.id).sort().join(",") !== expectedIds.join(",")) throw new Error("controlled_pilot_case_set_invalid");

function revisionDigest(target) {
  const result = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8", timeout: 5_000 });
  if (result.status !== 0) throw new Error("controlled_pilot_revision_unavailable");
  return digestValue(result.stdout.trim());
}

async function runCase(item) {
  const target = fs.realpathSync(path.resolve(item.path));
  if (!fs.statSync(target).isDirectory()) throw new Error(`controlled_pilot_source_not_directory:${item.id}`);
  const budget = {
    ...DEFAULT_SOURCE_BUDGET,
    max_items: Math.min(Number(item.max_items || 250), 500),
    max_item_bytes: Math.min(Number(item.max_item_bytes || 512_000), 1_000_000),
    max_total_bytes: Math.min(Number(item.max_total_bytes || 8_000_000), 12_000_000),
    timeout_ms: Math.min(Number(item.timeout_ms || 30_000), 60_000)
  };
  const descriptor = {
    contract_version: "1.0.0",
    id: `controlled.${item.id}`,
    provider: "filesystem",
    locator: target,
    authority: "supporting",
    scope: `controlled.${item.id}`,
    confidentiality: "internal",
    freshness: {},
    read_only: true,
    configuration: {}
  };
  const provider = createFilesystemSourceProvider();
  const payloads = await provider.scan(descriptor, budget);
  const snapshot = buildSourceSnapshot(descriptor, payloads, undefined, budget);
  const conversion = await convertPayloads(snapshot, payloads, budget);
  const knowledge = organizeKnowledge({ units: conversion.units, budgets: { max_assertions: 20_000, max_relations: 20_000, max_conflicts: 5_000 } });
  const processUnits = conversion.units.filter((unit) => typeof unit.content === "string").slice(0, 50);
  const observations = observationsFromUnits(processUnits, { mode: "observed", process_hint: `${item.id}_observed_work` });
  const baseStateDigest = digestValue({ scope: item.id, revision: 0, records: {} });
  const cycle = planAutonomicCycle({
    id: `cycle.controlled.${item.id}`,
    scope: `controlled.${item.id}`,
    observed_at: config.observed_at,
    source_snapshot_refs: [{ source_id: descriptor.id, snapshot_digest: snapshot.digest }],
    units: conversion.units,
    observations,
    base_state_digest: baseStateDigest,
    evolution_evidence_refs: ["evidence:controlled-observe"]
  });
  const body = {
    id: `pilot.controlled.${item.id}`,
    source_alias: item.id,
    source_kind: "real_repository_subset",
    source_revision_digest: revisionDigest(target),
    snapshot_digest: snapshot.digest,
    cycle_digest: cycle.digest,
    mode: "observe_suggest",
    source_item_count: payloads.length,
    normalized_unit_count: conversion.units.length,
    blocking_conversion_diagnostic_count: conversion.diagnostics.filter((entry) => entry.severity === "blocking").length,
    assertion_count: knowledge.assertions.length,
    relation_count: knowledge.relation_facts.length,
    conflict_count: knowledge.conflicts.length,
    process_observation_count: observations.length,
    process_candidate_count: cycle.processes.candidates.length,
    technology_draft_allowed_count: cycle.processes.draft_allowed_count,
    evolution_change_proposal_count: cycle.evolution_proposal.changes.length,
    cycle_status: cycle.status,
    protected_or_effectful_change_applied: false,
    production_effects: false,
    canonical_write_allowed: false,
    raw_paths_disclosed: false,
    raw_content_disclosed: false,
    review_status: "pending_independent_review"
  };
  return { ...body, digest: digestValue(body) };
}

(async () => {
  const results = [];
  for (const item of [...config.cases].sort((a, b) => a.id.localeCompare(b.id))) results.push(await runCase(item));
  const body = {
    contract_version: "1.0.0",
    release_target: "2.2.0",
    observed_at: config.observed_at,
    status: "controlled_observe_complete",
    case_count: results.length,
    results,
    independent_review: "pending",
    owner_decision: "ai_assisted_independent_review_may_substitute_for_human_review_for_this_release",
    production_effects: false,
    canonical_write_allowed: false,
    limitations: [
      "Three source sets are private and represented only by sanitized aggregates and digests.",
      "Observe/suggest results do not establish correctness of extracted knowledge or discovered processes.",
      "No production effect, canonical merge or automatic technology promotion was performed.",
      "Owner-authorized AI-assisted review is not external human peer review."
    ]
  };
  const output = { ...body, digest: digestValue(body) };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: output.status, case_count: output.case_count, output: path.resolve(outputPath), canonical_write_allowed: false }, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
