#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const repositoryRoot = path.resolve(__dirname, "../..");
const { digestValue } = require(path.join(repositoryRoot, "dist/cjs/core"));
const { organizeKnowledge } = require(path.join(repositoryRoot, "dist/cjs/knowledge"));
const { buildSourceSnapshot, convertPayloads, createFilesystemSourceProvider, DEFAULT_SOURCE_BUDGET } = require(path.join(repositoryRoot, "dist/cjs/sources"));
const { observationsFromUnits } = require(path.join(repositoryRoot, "dist/cjs/technology"));
const { planAutonomicCycle } = require(path.join(repositoryRoot, "dist/cjs/evolution"));
const {
  CLAIM_BOUNDARY,
  INDEPENDENT_REVIEW,
  LIMITATIONS,
  OWNER_DECISION
} = require("./mirai-2.2-controlled-pilot-contract");

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeNewTemporaryOutput(value) {
  const requested = path.resolve(value);
  if (path.extname(requested) !== ".json") throw new Error("controlled_pilot_output_must_be_json");
  const parent = path.dirname(requested);
  if (!fs.existsSync(parent)) throw new Error("controlled_pilot_output_parent_missing");
  const temporaryRoots = [os.tmpdir(), "/tmp"]
    .filter((entry, index, values) => values.indexOf(entry) === index && fs.existsSync(entry))
    .map((entry) => fs.realpathSync(entry));
  const realParent = fs.realpathSync(parent);
  const candidate = path.join(realParent, path.basename(requested));
  const realRepositoryRoot = fs.realpathSync(repositoryRoot);
  if (isWithin(realRepositoryRoot, candidate)) throw new Error("controlled_pilot_output_overlaps_runner_repository");
  if (!temporaryRoots.some((root) => isWithin(root, candidate))) throw new Error("controlled_pilot_output_must_be_temporary");
  if (fs.existsSync(candidate)) throw new Error("controlled_pilot_output_already_exists");
  return candidate;
}

function runGit(target, args) {
  const result = spawnSync("git", ["-C", target, ...args], { encoding: "utf8", timeout: 15_000 });
  if (result.status !== 0) throw new Error(`controlled_pilot_git_probe_failed:${args.join("_")}`);
  return result.stdout;
}

function gitState(target) {
  const root = runGit(target, ["rev-parse", "--show-toplevel"]).trim();
  const revision = runGit(root, ["rev-parse", "HEAD"]).trim();
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  return {
    revision_digest: digestValue(revision),
    status_digest: digestValue(status),
    clean: status.trim() === ""
  };
}

function filesUnder(relativeRoots) {
  const files = [];
  function walk(absolute, relative) {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const entryAbsolute = path.join(absolute, entry.name);
      const entryRelative = path.join(relative, entry.name).split(path.sep).join("/");
      if (entry.isSymbolicLink()) throw new Error(`controlled_pilot_runtime_symlink_forbidden:${entryRelative}`);
      if (entry.isDirectory()) walk(entryAbsolute, entryRelative);
      else if (entry.isFile()) files.push({ path: entryRelative, sha256: sha256(fs.readFileSync(entryAbsolute)) });
    }
  }
  for (const relativeRoot of relativeRoots) walk(path.join(repositoryRoot, relativeRoot), relativeRoot);
  return files;
}

const configPath = option("--config");
const outputOption = option("--out");
if (!configPath || !outputOption) {
  process.stderr.write("Usage: run-mirai-2.2-controlled-pilots.js --config <local-config.json> --out </temporary/new-result.json>\n");
  process.exit(2);
}

let outputPath;
try {
  outputPath = safeNewTemporaryOutput(outputOption);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}

const configBytes = fs.readFileSync(path.resolve(configPath));
const config = JSON.parse(configBytes.toString("utf8"));
if (config.contract_version !== "1.0.0" || !Array.isArray(config.cases) || config.cases.length !== 4) throw new Error("controlled_pilot_config_invalid");
const expectedIds = ["ai-employee", "federation", "modular-software", "self-hosting"];
if (config.cases.map((item) => item.id).sort().join(",") !== expectedIds.join(",")) throw new Error("controlled_pilot_case_set_invalid");

const publicConfig = {
  contract_version: config.contract_version,
  observed_at: config.observed_at,
  cases: [...config.cases].map((item) => ({
    id: item.id,
    max_items: Math.min(Number(item.max_items || 250), 500),
    max_item_bytes: Math.min(Number(item.max_item_bytes || 512_000), 1_000_000),
    max_total_bytes: Math.min(Number(item.max_total_bytes || 8_000_000), 12_000_000),
    timeout_ms: Math.min(Number(item.timeout_ms || 30_000), 60_000)
  })).sort((a, b) => a.id.localeCompare(b.id))
};

const runnerStateBefore = gitState(repositoryRoot);
const executionProvenanceBase = {
  runner_revision: runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim(),
  runner_source_sha256: sha256(fs.readFileSync(__filename)),
  runtime_dist_digest: digestValue(filesUnder(["dist/cjs/core", "dist/cjs/evolution", "dist/cjs/knowledge", "dist/cjs/sources", "dist/cjs/technology"])),
  dependency_lock_sha256: sha256(fs.readFileSync(path.join(repositoryRoot, "package-lock.json"))),
  public_config_digest: digestValue(publicConfig),
  private_config_digest: sha256(configBytes),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  runner_worktree_clean_before: runnerStateBefore.clean,
  runner_worktree_status_digest_before: runnerStateBefore.status_digest
};

async function runCase(item) {
  const target = fs.realpathSync(path.resolve(item.path));
  if (!fs.statSync(target).isDirectory()) throw new Error(`controlled_pilot_source_not_directory:${item.id}`);
  if (isWithin(target, outputPath) || isWithin(outputPath, target)) throw new Error(`controlled_pilot_output_overlaps_source:${item.id}`);
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
  const stateBefore = gitState(target);
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
  const payloadsAfter = await provider.scan(descriptor, budget);
  const snapshotAfter = buildSourceSnapshot(descriptor, payloadsAfter, undefined, budget);
  const stateAfter = gitState(target);
  if (snapshot.digest !== snapshotAfter.digest || stateBefore.status_digest !== stateAfter.status_digest || stateBefore.revision_digest !== stateAfter.revision_digest) {
    throw new Error(`controlled_pilot_source_changed_during_run:${item.id}`);
  }
  const body = {
    id: `pilot.controlled.${item.id}`,
    source_alias: item.id,
    source_kind: "real_repository_subset",
    source_revision_digest: stateBefore.revision_digest,
    source_git_clean_before: stateBefore.clean,
    source_git_state_digest_before: stateBefore.status_digest,
    source_git_state_digest_after: stateAfter.status_digest,
    source_git_state_unchanged: true,
    source_descriptor_digest: digestValue({ ...descriptor, locator: digestValue(target), configuration: undefined }),
    snapshot_digest: snapshot.digest,
    snapshot_digest_after: snapshotAfter.digest,
    source_snapshot_unchanged: true,
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
    invoked_operations: ["filesystem.scan", "source.snapshot", "source.convert", "knowledge.organize", "technology.observe", "evolution.plan"],
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
  const runnerStateAfter = gitState(repositoryRoot);
  if (runnerStateBefore.status_digest !== runnerStateAfter.status_digest || runnerStateBefore.revision_digest !== runnerStateAfter.revision_digest) {
    throw new Error("controlled_pilot_runner_repository_changed_during_run");
  }
  const execution_provenance = {
    ...executionProvenanceBase,
    runner_worktree_clean_after: runnerStateAfter.clean,
    runner_worktree_status_digest_after: runnerStateAfter.status_digest,
    runner_worktree_unchanged: true
  };
  const effect_audit = {
    output_policy: "new_json_file_in_os_temporary_directory",
    output_existed_before: false,
    allowed_write_count: 1,
    source_snapshots_unchanged: results.every((item) => item.source_snapshot_unchanged),
    source_git_states_unchanged: results.every((item) => item.source_git_state_unchanged),
    external_effect_adapters_invoked: false,
    canonical_write_attempted: false
  };
  const body = {
    contract_version: "1.0.0",
    release_target: "2.2.0",
    observed_at: config.observed_at,
    status: "controlled_observe_complete",
    case_count: results.length,
    execution_provenance,
    effect_audit,
    results,
    independent_review: INDEPENDENT_REVIEW,
    owner_decision: OWNER_DECISION,
    claim_boundary: CLAIM_BOUNDARY,
    production_effects: false,
    canonical_write_allowed: false,
    limitations: LIMITATIONS
  };
  const output = { ...body, digest: digestValue(body) };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  const runnerStateAfterOutput = gitState(repositoryRoot);
  if (runnerStateAfter.status_digest !== runnerStateAfterOutput.status_digest || runnerStateAfter.revision_digest !== runnerStateAfterOutput.revision_digest) {
    fs.rmSync(outputPath, { force: true });
    throw new Error("controlled_pilot_runner_repository_changed_after_output");
  }
  process.stdout.write(`${JSON.stringify({ status: output.status, case_count: output.case_count, output: outputPath, canonical_write_allowed: false }, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
