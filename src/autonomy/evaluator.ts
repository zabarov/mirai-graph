import { digestValue, withoutDigest } from "../core/canonical.js";
import {
  AUTONOMY_ENVELOPE_CONTRACT_VERSION,
  EVOLUTION_DECISION_CONTRACT_VERSION,
  EVOLUTION_PROPOSAL_CONTRACT_VERSION,
  type AutonomyEnvelope,
  type EvolutionChange,
  type EvolutionChangeDecision,
  type EvolutionDecision,
  type EvolutionProposal,
  type EvolutionRisk
} from "./types.js";

const RISK_ORDER: Record<EvolutionRisk, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const NEVER_AUTOMATIC = new Set(["protected_invariant", "authority", "capability", "approval", "conflict_resolution", "effectful_program", "history_deletion", "autonomy_envelope"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_ADAPTIVE_TARGET = /^adaptive\/[A-Za-z0-9._:/-]+$/;

function safeAdaptiveTarget(value: unknown): value is string {
  return typeof value === "string" && SAFE_ADAPTIVE_TARGET.test(value) && !value.split("/").some((part) => part === "." || part === "..");
}

function matchPattern(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

export function validateAutonomyEnvelope(envelope: AutonomyEnvelope, now: string): string[] {
  const errors: string[] = [];
  if (envelope.contract_version !== AUTONOMY_ENVELOPE_CONTRACT_VERSION) errors.push("autonomy_envelope_contract_unsupported");
  if (envelope.canonical_write_allowed !== false) errors.push("autonomy_envelope_canonical_write_must_be_false");
  if (digestValue(withoutDigest(envelope as unknown as Record<string, unknown>)) !== envelope.digest) errors.push("autonomy_envelope_digest_mismatch");
  if (!SAFE_ID.test(String(envelope.id || "")) || !String(envelope.scope || "").trim()) errors.push("autonomy_envelope_identity_invalid");
  if (!Array.isArray(envelope.approver_signatures) || !envelope.approver_signatures.length) errors.push("autonomy_envelope_signature_required");
  if (typeof envelope.policy_digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(envelope.policy_digest)) errors.push("autonomy_policy_digest_required");
  if (!envelope.rollback_contract?.required || !envelope.rollback_contract?.verify_readback) errors.push("autonomy_rollback_contract_required");
  if (!Number.isFinite(envelope.confidence_floor) || envelope.confidence_floor < 0 || envelope.confidence_floor > 1) errors.push("autonomy_confidence_floor_invalid");
  const nowTime = Date.parse(now);
  const issuedTime = Date.parse(envelope.issued_at);
  const expiryTime = Date.parse(envelope.expires_at);
  if (!Number.isFinite(nowTime) || !Number.isFinite(issuedTime) || !Number.isFinite(expiryTime) || issuedTime > nowTime || expiryTime <= nowTime) errors.push("autonomy_envelope_not_active");
  if (!Number.isSafeInteger(envelope.change_budget?.max_changes) || envelope.change_budget.max_changes < 1 || !Number.isSafeInteger(envelope.change_budget?.max_payload_bytes) || envelope.change_budget.max_payload_bytes < 1) errors.push("autonomy_change_budget_invalid");
  if (!Array.isArray(envelope.allowed_change_kinds) || !Array.isArray(envelope.resource_patterns) || !envelope.resource_patterns.length || !Array.isArray(envelope.forbidden_targets) || !Array.isArray(envelope.evidence_requirements)) errors.push("autonomy_envelope_boundary_invalid");
  if (Array.isArray(envelope.allowed_change_kinds) && envelope.allowed_change_kinds.some((kind) => NEVER_AUTOMATIC.has(kind))) errors.push("autonomy_envelope_protected_kind_forbidden");
  return [...new Set(errors)].sort();
}

export function validateEvolutionProposal(proposal: EvolutionProposal): string[] {
  const errors: string[] = [];
  if (proposal.contract_version !== EVOLUTION_PROPOSAL_CONTRACT_VERSION) errors.push("evolution_proposal_contract_unsupported");
  if (proposal.canonical_write_allowed !== false) errors.push("evolution_proposal_canonical_write_must_be_false");
  if (digestValue(withoutDigest(proposal as unknown as Record<string, unknown>)) !== proposal.digest) errors.push("evolution_proposal_digest_mismatch");
  if (!SAFE_ID.test(String(proposal.id || "")) || !String(proposal.scope || "").trim()) errors.push("evolution_proposal_identity_invalid");
  if (!Array.isArray(proposal.changes)) errors.push("evolution_proposal_changes_required");
  const seen = new Set<string>();
  for (const change of Array.isArray(proposal.changes) ? proposal.changes : []) {
    if (!SAFE_ID.test(String(change.id || "")) || seen.has(change.id)) errors.push(`evolution_change_identity_invalid:${change.id || "missing"}`);
    seen.add(change.id);
    if (!safeAdaptiveTarget(change.target_ref)) errors.push(`evolution_change_target_invalid:${change.id}`);
    if (!change.payload || typeof change.payload !== "object" || Array.isArray(change.payload) || digestValue(change.payload) !== change.payload_digest) errors.push(`evolution_change_payload_digest_mismatch:${change.id}`);
    if (!Array.isArray(change.evidence_refs) || !Array.isArray(change.successful_replay_refs) || !Array.isArray(change.conflict_refs)) errors.push(`evolution_change_evidence_shape_invalid:${change.id}`);
    if (!Number.isFinite(change.confidence) || change.confidence < 0 || change.confidence > 1) errors.push(`evolution_change_confidence_invalid:${change.id}`);
  }
  return [...new Set(errors)].sort();
}

function decideChange(change: EvolutionChange, proposal: EvolutionProposal, envelope: AutonomyEnvelope): EvolutionChangeDecision {
  const reasons: string[] = [];
  if (NEVER_AUTOMATIC.has(change.kind)) reasons.push("change_kind_never_automatic");
  if (change.stratum !== "adaptive_canonical") reasons.push("change_outside_adaptive_stratum");
  if (!Array.isArray(envelope.allowed_change_kinds) || !envelope.allowed_change_kinds.includes(change.kind as never)) reasons.push("change_kind_not_allowed");
  if (change.risk === "high" || change.risk === "critical" || RISK_ORDER[change.risk] > RISK_ORDER[envelope.risk_ceiling]) reasons.push("risk_ceiling_exceeded");
  if (change.confidence < envelope.confidence_floor) reasons.push("confidence_below_floor");
  if (!change.reversible) reasons.push("change_not_reversible");
  if (change.effectful) reasons.push("effectful_change_requires_approval");
  if (!Array.isArray(change.conflict_refs) || change.conflict_refs.length) reasons.push("conflict_resolution_requires_review");
  if (proposal.scope !== envelope.scope) reasons.push("autonomy_scope_mismatch");
  if (!safeAdaptiveTarget(change.target_ref) || !Array.isArray(envelope.resource_patterns) || !envelope.resource_patterns.some((pattern) => matchPattern(change.target_ref, pattern))) reasons.push("resource_outside_envelope");
  if (Array.isArray(envelope.forbidden_targets) && envelope.forbidden_targets.some((pattern) => matchPattern(change.target_ref, pattern))) reasons.push("target_explicitly_forbidden");
  if (!safeAdaptiveTarget(change.target_ref)) reasons.push("adaptive_target_prefix_required");
  for (const evidence of Array.isArray(envelope.evidence_requirements) ? envelope.evidence_requirements : []) if (!Array.isArray(change.evidence_refs) || !change.evidence_refs.includes(evidence)) reasons.push(`required_evidence_missing:${evidence}`);
  if (Array.isArray(envelope.replay_requirements?.required_for) && envelope.replay_requirements.required_for.includes(change.kind as never) && (!Array.isArray(change.successful_replay_refs) || change.successful_replay_refs.length < envelope.replay_requirements.minimum_successful_replays)) reasons.push("successful_replay_requirement_missing");
  const denied = reasons.some((reason) => /never_automatic|outside_adaptive|effectful|conflict|explicitly_forbidden|target_prefix/.test(reason));
  return { change_id: change.id, verdict: reasons.length ? (denied ? "deny" : "manual_review") : "allow_automatic", reason_codes: reasons };
}

export function evaluateEvolutionProposal(proposal: EvolutionProposal, envelope: AutonomyEnvelope, now: string): EvolutionDecision {
  const envelopeErrors = validateAutonomyEnvelope(envelope, now);
  const proposalErrors = validateEvolutionProposal(proposal);
  const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
  const payloadBytes = Buffer.byteLength(JSON.stringify(changes.map((item) => item.payload)));
  const decisions = changes.map((change) => decideChange(change, proposal, envelope));
  const budgetErrors: string[] = [];
  if (changes.length > Number(envelope.change_budget?.max_changes || 0)) budgetErrors.push("change_count_budget_exceeded");
  if (payloadBytes > Number(envelope.change_budget?.max_payload_bytes || 0)) budgetErrors.push("change_payload_budget_exceeded");
  if (budgetErrors.length) decisions.forEach((item) => { item.verdict = "deny"; item.reason_codes.push(...budgetErrors); });
  if (envelopeErrors.length || proposalErrors.length) decisions.forEach((item) => { item.verdict = "deny"; item.reason_codes.push(...envelopeErrors, ...proposalErrors); });
  decisions.forEach((item) => { item.reason_codes = [...new Set(item.reason_codes)].sort(); });
  const globalDenied = budgetErrors.length > 0 || envelopeErrors.length > 0 || proposalErrors.length > 0;
  const verdict = globalDenied || decisions.some((item) => item.verdict === "deny") ? "denied" as const
    : decisions.some((item) => item.verdict === "manual_review") ? "manual_review_required" as const
      : "automatic_promotion_allowed" as const;
  const candidate = {
    contract_version: EVOLUTION_DECISION_CONTRACT_VERSION,
    proposal_id: proposal.id,
    proposal_digest: proposal.digest,
    envelope_id: envelope.id,
    envelope_digest: envelope.digest,
    evaluated_at: now,
    change_decisions: decisions,
    verdict,
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
