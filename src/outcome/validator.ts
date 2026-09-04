import { digestValue, withoutDigest } from "../core/index.js";
import type { OutcomeCandidateSet, OutcomeCompletionContract, OutcomeEvidenceSet, OutcomeValidationResult } from "./types.js";

const idPattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function validateOutcomeContract(contract: OutcomeCompletionContract): OutcomeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!contract || contract.contract_version !== "1.0.0") errors.push("unsupported_contract_version");
  if (!idPattern.test(contract?.id || "")) errors.push("invalid_contract_id");
  if (!contract?.goal?.trim()) errors.push("goal_required");
  if (!contract?.scope?.purpose || !contract.scope.domains?.length) errors.push("scope_required");
  if (contract?.canonical_write_allowed !== false) errors.push("canonical_write_must_be_false");
  if (contract?.execution_allowed !== false) errors.push("execution_allowed_must_be_false");
  if (contract?.template_authority === "ephemeral_read_only" && contract.scope.effect !== "read_only") errors.push("ephemeral_contract_must_be_read_only");
  const slots = [...(contract?.required_slots || []), ...(contract?.optional_slots || [])];
  if (!contract?.required_slots?.some((slot) => slot.critical && slot.evidence_required === true)) errors.push("critical_evidence_required_slot_missing");
  const ids = slots.map((slot) => slot.id);
  if (new Set(ids).size !== ids.length) errors.push("duplicate_slot_id");
  if (slots.some((slot) => !idPattern.test(slot.id) || !slot.label?.trim())) errors.push("invalid_slot_definition");
  if (slots.some((slot) => slot.critical && slot.evidence_required !== true)) errors.push("critical_slot_requires_evidence");
  if (contract?.required_slots?.some((slot) => !slot.critical) && contract.completion_policy?.all_critical_required) warnings.push("required_noncritical_slot_allows_partial_only");
  if (!contract?.digest || contract.digest !== digestValue(withoutDigest(contract as unknown as Record<string, unknown>))) errors.push("contract_digest_mismatch");
  return { valid: errors.length === 0, errors, warnings };
}

export function assertOutcomeCandidateSet(candidates: OutcomeCandidateSet): void {
  if (!candidates || candidates.contract_version !== "1.0.0" || !Array.isArray(candidates.candidates)) throw new Error("outcome_candidate_set_invalid");
  if (candidates.accepted !== false || candidates.execution_allowed !== false || candidates.content_is_untrusted_data !== true || candidates.canonical_write_allowed !== false) throw new Error("outcome_candidate_trust_boundary_broken");
  if (!candidates.context || !Array.isArray(candidates.context.domains) || !["available", "temporarily_unavailable", "failed"].includes(candidates.context.availability)) throw new Error("outcome_candidate_context_invalid");
  if (candidates.candidates.some((candidate) => !idPattern.test(candidate.id) || !idPattern.test(candidate.slot_id) || !Array.isArray(candidate.evidence_refs) || !Array.isArray(candidate.source_refs))) throw new Error("outcome_candidate_invalid");
  if (!candidates.digest || candidates.digest !== digestValue(withoutDigest(candidates as unknown as Record<string, unknown>))) throw new Error("outcome_candidate_set_digest_mismatch");
}

export function assertOutcomeEvidenceSet(evidence: OutcomeEvidenceSet): void {
  const authorities = new Set(["canonical_external", "canonical", "owner_asserted", "supporting", "informational", "derived", "proposal"]);
  const freshness = new Set(["current", "aging", "stale", "unknown"]);
  if (!evidence || evidence.contract_version !== "1.0.0" || !Array.isArray(evidence.items) || !Array.isArray(evidence.limitations)) throw new Error("outcome_evidence_set_invalid");
  if (evidence.canonical_write_allowed !== false) throw new Error("outcome_evidence_canonical_write_must_be_false");
  if (!digestPattern.test(evidence.snapshot_digest) || !digestPattern.test(evidence.policy_digest)) throw new Error("outcome_evidence_binding_invalid");
  if (evidence.items.some((item) => !idPattern.test(item.id) || !item.source_ref || !idPattern.test(item.slot_id) || !digestPattern.test(item.contract_digest) || !digestPattern.test(item.value_digest) || !digestPattern.test(item.admission_receipt_digest) || !digestPattern.test(item.digest) || item.digest !== digestValue(withoutDigest(item as unknown as Record<string, unknown>)) || !authorities.has(item.authority) || !freshness.has(item.freshness) || !Array.isArray(item.conflict_refs) || typeof item.authorized !== "boolean")) throw new Error("outcome_evidence_item_invalid");
  if (!evidence.digest || evidence.digest !== digestValue(withoutDigest(evidence as unknown as Record<string, unknown>))) throw new Error("outcome_evidence_set_digest_mismatch");
}

export function assertOutcomeContract(contract: OutcomeCompletionContract): void {
  const result = validateOutcomeContract(contract);
  if (!result.valid) throw new Error(result.errors.join(","));
}
