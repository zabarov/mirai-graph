#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue, withoutDigest } = require("../../dist/cjs/core");
const {
  CLAIM_BOUNDARY,
  INDEPENDENT_REVIEW,
  LIMITATIONS,
  OWNER_DECISION
} = require("./mirai-2.2-controlled-pilot-contract");

const root = path.resolve(__dirname, "../..");
const inputIndex = process.argv.indexOf("--input");
const target = inputIndex >= 0 ? path.resolve(process.argv[inputIndex + 1]) : path.join(root, "pilots/mirai-2.2-controlled-observe/pilot-result.json");
const report = JSON.parse(fs.readFileSync(target, "utf8"));
const errors = [];
const expectedIds = ["pilot.controlled.ai-employee", "pilot.controlled.federation", "pilot.controlled.modular-software", "pilot.controlled.self-hosting"];
const rootKeys = ["canonical_write_allowed", "case_count", "claim_boundary", "contract_version", "digest", "effect_audit", "execution_provenance", "independent_review", "limitations", "observed_at", "owner_decision", "production_effects", "release_target", "results", "status"];
const resultKeys = ["assertion_count", "blocking_conversion_diagnostic_count", "canonical_write_allowed", "conflict_count", "cycle_digest", "cycle_status", "digest", "evolution_change_proposal_count", "id", "invoked_operations", "mode", "normalized_unit_count", "process_candidate_count", "process_observation_count", "production_effects", "protected_or_effectful_change_applied", "raw_content_disclosed", "raw_paths_disclosed", "relation_count", "review_status", "snapshot_digest", "snapshot_digest_after", "source_alias", "source_descriptor_digest", "source_git_clean_before", "source_git_state_digest_after", "source_git_state_digest_before", "source_git_state_unchanged", "source_item_count", "source_kind", "source_revision_digest", "source_snapshot_unchanged", "technology_draft_allowed_count"];
const provenanceKeys = ["dependency_lock_sha256", "private_config_digest", "public_config_digest", "runner_revision", "runner_source_sha256", "runner_worktree_clean_after", "runner_worktree_clean_before", "runner_worktree_status_digest_after", "runner_worktree_status_digest_before", "runner_worktree_unchanged", "runtime", "runtime_dist_digest"];
const runtimeKeys = ["arch", "node", "platform"];
const auditKeys = ["allowed_write_count", "canonical_write_attempted", "external_effect_adapters_invoked", "output_existed_before", "output_policy", "source_git_states_unchanged", "source_snapshots_unchanged"];
const allowedOperations = ["filesystem.scan", "source.snapshot", "source.convert", "knowledge.organize", "technology.observe", "evolution.plan"];
const expectedSourceAliases = new Map([
  ["pilot.controlled.ai-employee", "ai-employee"],
  ["pilot.controlled.federation", "federation"],
  ["pilot.controlled.modular-software", "modular-software"],
  ["pilot.controlled.self-hosting", "self-hosting"]
]);

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label}:object_required`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  const extra = actual.filter((key) => !wanted.includes(key));
  const missing = wanted.filter((key) => !actual.includes(key));
  if (extra.length) errors.push(`${label}:unexpected_fields:${extra.join(",")}`);
  if (missing.length) errors.push(`${label}:missing_fields:${missing.join(",")}`);
}

function digest(value, label) {
  if (!/^sha256:[a-f0-9]{64}$/.test(String(value || ""))) errors.push(`${label}:digest_invalid`);
}

function count(value, label) {
  if (!Number.isInteger(value) || value < 0) errors.push(`${label}:count_invalid`);
}

function containsPrivatePath(value) {
  if (Array.isArray(value)) return value.some(containsPrivatePath);
  if (value && typeof value === "object") return Object.values(value).some(containsPrivatePath);
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (/file:\/\//i.test(text)) return true;
  if (/(?:^|[^A-Za-z0-9])[a-z]:[\\/]/i.test(text)) return true;
  if (value.includes("\\\\")) return true;
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] !== "/" || value[index + 1] === "/") continue;
    const previous = index > 0 ? value[index - 1] : "";
    if (previous && /[A-Za-z0-9_./]/.test(previous)) continue;
    if (/[A-Za-z0-9._~$%+-]/.test(value[index + 1])) return true;
  }
  return false;
}

exactKeys(report, rootKeys, "report");
if (report.contract_version !== "1.0.0" || report.release_target !== "2.2.0") errors.push("controlled_pilot_contract_invalid");
if (report.status !== "controlled_observe_complete" || report.case_count !== 4) errors.push("controlled_pilot_suite_incomplete");
if (!Array.isArray(report.results) || report.results.map((item) => item.id).sort().join(",") !== expectedIds.join(",")) errors.push("controlled_pilot_case_set_invalid");
if (report.production_effects !== false || report.canonical_write_allowed !== false) errors.push("controlled_pilot_boundary_invalid");
if (report.independent_review !== INDEPENDENT_REVIEW || report.owner_decision !== OWNER_DECISION || report.claim_boundary !== CLAIM_BOUNDARY || JSON.stringify(report.limitations) !== JSON.stringify(LIMITATIONS)) errors.push("controlled_pilot_review_claim_invalid");
digest(report.digest, "report");
if (digestValue(withoutDigest(report)) !== report.digest) errors.push("controlled_pilot_report_digest_mismatch");

exactKeys(report.execution_provenance, provenanceKeys, "execution_provenance");
exactKeys(report.execution_provenance?.runtime, runtimeKeys, "execution_provenance.runtime");
if (!/^[a-f0-9]{40}$/.test(String(report.execution_provenance?.runner_revision || ""))) errors.push("runner_revision_invalid");
for (const key of ["runner_source_sha256", "runtime_dist_digest", "dependency_lock_sha256", "public_config_digest", "private_config_digest", "runner_worktree_status_digest_before", "runner_worktree_status_digest_after"]) digest(report.execution_provenance?.[key], `execution_provenance.${key}`);
if (report.execution_provenance?.runner_worktree_unchanged !== true || report.execution_provenance?.runner_worktree_status_digest_before !== report.execution_provenance?.runner_worktree_status_digest_after) errors.push("runner_worktree_changed");
if (typeof report.execution_provenance?.runner_worktree_clean_before !== "boolean" || typeof report.execution_provenance?.runner_worktree_clean_after !== "boolean") errors.push("runner_worktree_clean_state_invalid");
if (!/^v(20|21|22|23|24)\./.test(String(report.execution_provenance?.runtime?.node || ""))) errors.push("runner_node_version_outside_package_engine");

exactKeys(report.effect_audit, auditKeys, "effect_audit");
if (report.effect_audit?.output_policy !== "new_json_file_in_os_temporary_directory" || report.effect_audit?.output_existed_before !== false || report.effect_audit?.allowed_write_count !== 1) errors.push("controlled_pilot_output_policy_invalid");
if (report.effect_audit?.source_snapshots_unchanged !== true || report.effect_audit?.source_git_states_unchanged !== true || report.effect_audit?.external_effect_adapters_invoked !== false || report.effect_audit?.canonical_write_attempted !== false) errors.push("controlled_pilot_effect_audit_failed");

for (const result of report.results || []) {
  exactKeys(result, resultKeys, result.id || "result");
  if (result.source_kind !== "real_repository_subset" || result.mode !== "observe_suggest") errors.push(`${result.id}:not_real_observe_pilot`);
  if (expectedSourceAliases.get(result.id) !== result.source_alias) errors.push(`${result.id}:source_alias_invalid`);
  count(result.source_item_count, `${result.id}:source_item_count`);
  count(result.normalized_unit_count, `${result.id}:normalized_unit_count`);
  for (const key of ["blocking_conversion_diagnostic_count", "assertion_count", "relation_count", "conflict_count", "process_observation_count", "process_candidate_count", "technology_draft_allowed_count", "evolution_change_proposal_count"]) count(result[key], `${result.id}:${key}`);
  if (result.source_item_count < 1 || result.normalized_unit_count < 1) errors.push(`${result.id}:source_evidence_missing`);
  if (result.production_effects !== false || result.canonical_write_allowed !== false || result.protected_or_effectful_change_applied !== false) errors.push(`${result.id}:safety_boundary_invalid`);
  if (result.raw_paths_disclosed !== false || result.raw_content_disclosed !== false) errors.push(`${result.id}:public_safety_invalid`);
  if (result.review_status !== "pending_independent_review") errors.push(`${result.id}:review_status_invalid`);
  if (result.technology_draft_allowed_count !== 0) errors.push(`${result.id}:observed_practice_promoted`);
  if (result.source_git_state_unchanged !== true || result.source_git_state_digest_before !== result.source_git_state_digest_after) errors.push(`${result.id}:source_git_state_changed`);
  if (result.source_snapshot_unchanged !== true || result.snapshot_digest !== result.snapshot_digest_after) errors.push(`${result.id}:source_snapshot_changed`);
  if (!Array.isArray(result.invoked_operations) || result.invoked_operations.join(",") !== allowedOperations.join(",")) errors.push(`${result.id}:operation_inventory_invalid`);
  for (const key of ["source_revision_digest", "source_git_state_digest_before", "source_git_state_digest_after", "source_descriptor_digest", "snapshot_digest", "snapshot_digest_after", "cycle_digest", "digest"]) digest(result[key], `${result.id}:${key}`);
  if (digestValue(withoutDigest(result)) !== result.digest) errors.push(`${result.id}:digest_mismatch`);
}
if (containsPrivatePath(report)) errors.push("controlled_pilot_private_path_disclosed");
const serialized = JSON.stringify(report);
if (/\/Users\/|\\Users\\|larena|simai|ai-codex/i.test(serialized)) errors.push("controlled_pilot_private_identifier_disclosed");
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ valid: true, case_count: report.case_count, mode: "observe_suggest", source_state_unchanged: true, production_effects: false, independent_review: report.independent_review }, null, 2)}\n`);
}
