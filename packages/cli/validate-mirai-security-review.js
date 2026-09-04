#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const target = process.argv[2] || "docs/security/mirai-independent-security-review-result.template.json";
const selfTest = target === "--self-test";
const sourceTarget = selfTest ? "docs/security/mirai-independent-security-review-result.template.json" : target;
const value = JSON.parse(fs.readFileSync(path.resolve(root, sourceTarget), "utf8"));
const profileIndex = process.argv.indexOf("--profile");
const profile = profileIndex >= 0 ? process.argv[profileIndex + 1] : "core_2_1";
if (!["core_2_1", "autonomic_fabric_2_2", "retrieval_fabric_2_4"].includes(profile)) throw new Error("unknown_security_review_profile");
const ownerDecisionRef = profile === "retrieval_fabric_2_4"
  ? "docs/security/mirai-2.4-independent-review-method-decision-2026-09-04.json"
  : profile === "autonomic_fabric_2_2"
    ? "docs/security/mirai-2.2-independent-review-method-decision-2026-09-03.json"
    : "docs/security/mirai-independent-review-method-decision-2026-09-02.json";
const ownerDecision = JSON.parse(fs.readFileSync(path.join(root, ownerDecisionRef), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-security-review-result.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const requiredScope = profile === "retrieval_fabric_2_4" ? [
  "authorization_before_index", "access_projection_binding",
  "confidential_reference_only", "secret_and_private_path_redaction",
  "embedding_artifact_binding", "index_integrity_and_atomic_replacement",
  "query_budget_and_timeout", "federated_scope_attenuation",
  "federated_result_validation", "prompt_injection_non_authority",
  "evidence_claim_binding", "canonical_write_prohibition"
] : profile === "autonomic_fabric_2_2" ? [
  "source_provider_boundaries", "converter_resource_budgets",
  "path_and_symlink_boundary", "cancellation_and_connection_retirement",
  "source_secret_redaction", "knowledge_identity_and_conflicts",
  "autonomy_authority", "protected_targets", "promotion_crash_recovery",
  "payload_budgets", "blocked_cycle_prohibition"
] : [
  "program_parsing", "path_and_symlink_boundary", "command_execution",
  "capability_scope", "approval_integrity", "crash_and_idempotency",
  "compensation", "evidence_redaction", "manifest_authority",
  "activation_budgets", "activation_policy_binding",
  "activation_host_budget_ceilings", "process_run_production_exclusion",
  "renewable_lease_and_generation_fencing",
  "cross_process_mutation_serialization",
  "runtime_private_root_ancestor_symlinks",
  "stale_mutation_lock_recovery",
  "production_runtime_composition",
  "npm_host_local_state_exclusion"
];
function assess(candidate, decision = ownerDecision) {
  const errors = [];
  if (!validate(candidate)) errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
  for (const item of requiredScope) if (!(candidate.scope || []).includes(item)) errors.push(`required_scope_missing:${item}`);
  const ids = new Set();
  for (const finding of candidate.findings || []) {
    if (ids.has(finding.id)) errors.push(`duplicate_finding:${finding.id}`);
    ids.add(finding.id);
  }
  const unresolvedBlocking = (candidate.findings || []).filter((finding) => ["critical", "high"].includes(finding.severity) && ["open", "accepted_risk"].includes(finding.status));
  const passing = ["pass_for_production_read", "pass_for_bounded_production_write"].includes(candidate.verdict);
  if (passing && unresolvedBlocking.length) errors.push("passing_verdict_with_unresolved_critical_or_high_finding");
  if (candidate.verdict === "pass_for_bounded_production_write" && !(candidate.adapter_scope || []).length) errors.push("bounded_write_verdict_requires_adapter_scope");
  if (candidate.evidence_class === "independent_ai_assisted_review") {
    if (!decision || decision.status !== "approved" || decision.accepted_evidence_class !== candidate.evidence_class) errors.push("ai_assisted_review_requires_owner_decision");
    if (decision?.reviewed_revision !== candidate.reviewed_revision) errors.push("ai_assisted_review_revision_not_approved");
    if (decision?.release_gate_scope !== "production_read_only" || decision?.production_write_authorized !== false) errors.push("ai_assisted_review_owner_scope_invalid");
    if (candidate.verdict === "pass_for_bounded_production_write") errors.push("ai_assisted_review_cannot_authorize_production_write");
    if (!/AI-assisted|AI assisted/i.test(candidate.attestation || "")) errors.push("ai_assisted_review_attestation_missing");
    if (!/not an external human|not external human|не является внешним человеческим/i.test(candidate.claim_boundary || "")) errors.push("ai_assisted_review_claim_boundary_missing");
  }
  if (/guarantees|unrestricted production|scientifically proven/i.test(candidate.claim_boundary || "")) errors.push("claim_boundary_overclaim");
  if (/\/Users\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(JSON.stringify(candidate))) errors.push("public_safety_violation");
  const evidenceEligible = candidate.evidence_class === "external_review"
    || (candidate.evidence_class === "independent_ai_assisted_review"
      && decision?.status === "approved"
      && decision?.accepted_evidence_class === candidate.evidence_class
      && decision?.reviewed_revision === candidate.reviewed_revision
      && decision?.release_gate_scope === "production_read_only"
      && decision?.production_write_authorized === false
      && candidate.verdict === "pass_for_production_read");
  const releaseGateEligible = errors.length === 0 && candidate.status === "complete" && evidenceEligible && candidate.reviewer?.independent === true && candidate.reviewer?.implemented_reviewed_changes === false && passing && !unresolvedBlocking.length;
  return { errors, releaseGateEligible };
}

if (selfTest) {
  const baseline = structuredClone(value);
  baseline.scope = [...requiredScope];
  const invalid = structuredClone(baseline);
  invalid.status = "complete";
  invalid.evidence_class = "external_review";
  invalid.reviewer.independent = true;
  invalid.verdict = "pass_for_production_read";
  invalid.findings = [{ id: "SEC-001", severity: "high", status: "accepted_risk", summary: "Blocking risk", reproduction: "Synthetic self-test", evidence_refs: [] }];
  const result = assess(invalid);
  const incompleteScope = structuredClone(baseline);
  const missingScope = profile === "retrieval_fabric_2_4" ? "federated_result_validation"
    : profile === "autonomic_fabric_2_2" ? "promotion_crash_recovery" : "stale_mutation_lock_recovery";
  incompleteScope.scope = incompleteScope.scope.filter((item) => item !== missingScope);
  const incompleteScopeResult = assess(incompleteScope);
  const aiWithoutDecision = structuredClone(baseline);
  aiWithoutDecision.status = "complete";
  aiWithoutDecision.evidence_class = "independent_ai_assisted_review";
  aiWithoutDecision.reviewed_revision = ownerDecision.reviewed_revision;
  aiWithoutDecision.reviewer.independent = true;
  aiWithoutDecision.verdict = "pass_for_production_read";
  aiWithoutDecision.attestation = "AI-assisted isolated review.";
  aiWithoutDecision.claim_boundary = "This is not an external human audit.";
  const aiWithoutDecisionResult = assess(aiWithoutDecision, null);
  const approvedAiResult = assess(aiWithoutDecision);
  const aiWrite = structuredClone(aiWithoutDecision);
  aiWrite.verdict = "pass_for_bounded_production_write";
  aiWrite.adapter_scope = ["workspace_patch"];
  const aiWriteResult = assess(aiWrite);
  const passed = result.errors.includes("passing_verdict_with_unresolved_critical_or_high_finding")
    && result.releaseGateEligible === false
    && incompleteScopeResult.errors.includes(`required_scope_missing:${missingScope}`)
    && aiWithoutDecisionResult.errors.includes("ai_assisted_review_requires_owner_decision")
    && aiWithoutDecisionResult.releaseGateEligible === false
    && approvedAiResult.errors.length === 0
    && approvedAiResult.releaseGateEligible === true
    && aiWriteResult.errors.includes("ai_assisted_review_cannot_authorize_production_write")
    && aiWriteResult.releaseGateEligible === false;
  process.stdout.write(`${JSON.stringify({
    valid: passed,
    self_tests: [
      "high_accepted_risk_blocks_release_gate",
      "missing_runtime_recovery_scope_fails_closed",
      "ai_assisted_review_without_owner_decision_fails_closed",
      "approved_ai_assisted_read_review_is_eligible",
      "ai_assisted_review_cannot_authorize_production_write"
    ],
    errors: result.errors,
    incomplete_scope_errors: incompleteScopeResult.errors,
    ai_without_decision_errors: aiWithoutDecisionResult.errors,
    ai_write_errors: aiWriteResult.errors
  }, null, 2)}\n`);
  process.exitCode = passed ? 0 : 1;
  return;
}

const { errors, releaseGateEligible } = assess(value);

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, target: sourceTarget, status: value.status, verdict: value.verdict, release_gate_eligible: valid && releaseGateEligible, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
