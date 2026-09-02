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

function matchPattern(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

export function validateAutonomyEnvelope(envelope: AutonomyEnvelope, now: string): string[] {
  const errors: string[] = [];
  if (envelope.contract_version !== AUTONOMY_ENVELOPE_CONTRACT_VERSION) errors.push("autonomy_envelope_contract_unsupported");
  if (envelope.canonical_write_allowed !== false) errors.push("autonomy_envelope_canonical_write_must_be_false");
  if (digestValue(withoutDigest(envelope as unknown as Record<string, unknown>)) !== envelope.digest) errors.push("autonomy_envelope_digest_mismatch");
  if (!envelope.approver_signatures.length) errors.push("autonomy_envelope_signature_required");
  if (!envelope.policy_digest.startsWith("sha256:")) errors.push("autonomy_policy_digest_required");
  if (!envelope.rollback_contract.required || !envelope.rollback_contract.verify_readback) errors.push("autonomy_rollback_contract_required");
  if (envelope.confidence_floor < 0 || envelope.confidence_floor > 1) errors.push("autonomy_confidence_floor_invalid");
  if (Date.parse(envelope.issued_at) > Date.parse(now) || Date.parse(envelope.expires_at) <= Date.parse(now)) errors.push("autonomy_envelope_not_active");
  if (envelope.change_budget.max_changes < 1 || envelope.change_budget.max_payload_bytes < 1) errors.push("autonomy_change_budget_invalid");
  return errors;
}

export function validateEvolutionProposal(proposal: EvolutionProposal): string[] {
  const errors: string[] = [];
  if (proposal.contract_version !== EVOLUTION_PROPOSAL_CONTRACT_VERSION) errors.push("evolution_proposal_contract_unsupported");
  if (proposal.canonical_write_allowed !== false) errors.push("evolution_proposal_canonical_write_must_be_false");
  if (digestValue(withoutDigest(proposal as unknown as Record<string, unknown>)) !== proposal.digest) errors.push("evolution_proposal_digest_mismatch");
  for (const change of proposal.changes) if (digestValue(change.payload) !== change.payload_digest) errors.push(`evolution_change_payload_digest_mismatch:${change.id}`);
  return errors;
}

function decideChange(change: EvolutionChange, proposal: EvolutionProposal, envelope: AutonomyEnvelope): EvolutionChangeDecision {
  const reasons: string[] = [];
  if (NEVER_AUTOMATIC.has(change.kind)) reasons.push("change_kind_never_automatic");
  if (change.stratum !== "adaptive_canonical") reasons.push("change_outside_adaptive_stratum");
  if (!envelope.allowed_change_kinds.includes(change.kind as never)) reasons.push("change_kind_not_allowed");
  if (change.risk === "high" || change.risk === "critical" || RISK_ORDER[change.risk] > RISK_ORDER[envelope.risk_ceiling]) reasons.push("risk_ceiling_exceeded");
  if (change.confidence < envelope.confidence_floor) reasons.push("confidence_below_floor");
  if (!change.reversible) reasons.push("change_not_reversible");
  if (change.effectful) reasons.push("effectful_change_requires_approval");
  if (change.conflict_refs.length) reasons.push("conflict_resolution_requires_review");
  if (proposal.scope !== envelope.scope) reasons.push("autonomy_scope_mismatch");
  if (!envelope.resource_patterns.some((pattern) => matchPattern(change.target_ref, pattern))) reasons.push("resource_outside_envelope");
  if (envelope.forbidden_targets.some((pattern) => matchPattern(change.target_ref, pattern))) reasons.push("target_explicitly_forbidden");
  if (!change.target_ref.startsWith("adaptive/")) reasons.push("adaptive_target_prefix_required");
  for (const evidence of envelope.evidence_requirements) if (!change.evidence_refs.includes(evidence)) reasons.push(`required_evidence_missing:${evidence}`);
  if (envelope.replay_requirements.required_for.includes(change.kind as never) && change.successful_replay_refs.length < envelope.replay_requirements.minimum_successful_replays) reasons.push("successful_replay_requirement_missing");
  const denied = reasons.some((reason) => /never_automatic|outside_adaptive|effectful|conflict|explicitly_forbidden|target_prefix/.test(reason));
  return { change_id: change.id, verdict: reasons.length ? (denied ? "deny" : "manual_review") : "allow_automatic", reason_codes: reasons };
}

export function evaluateEvolutionProposal(proposal: EvolutionProposal, envelope: AutonomyEnvelope, now: string): EvolutionDecision {
  const envelopeErrors = validateAutonomyEnvelope(envelope, now);
  const proposalErrors = validateEvolutionProposal(proposal);
  const payloadBytes = Buffer.byteLength(JSON.stringify(proposal.changes.map((item) => item.payload)));
  const decisions = proposal.changes.map((change) => decideChange(change, proposal, envelope));
  if (proposal.changes.length > envelope.change_budget.max_changes) decisions.forEach((item) => item.reason_codes.push("change_count_budget_exceeded"));
  if (payloadBytes > envelope.change_budget.max_payload_bytes) decisions.forEach((item) => item.reason_codes.push("change_payload_budget_exceeded"));
  if (envelopeErrors.length || proposalErrors.length) decisions.forEach((item) => { item.verdict = "deny"; item.reason_codes.push(...envelopeErrors, ...proposalErrors); });
  const verdict = decisions.some((item) => item.verdict === "deny") ? "denied" as const
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
