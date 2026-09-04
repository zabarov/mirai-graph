export const OUTCOME_CONTRACT_VERSION = "1.0.0" as const;

export type OutcomeStatus =
  | "satisfied"
  | "partially_satisfied"
  | "needs_input"
  | "blocked_by_conflict"
  | "out_of_scope"
  | "insufficient_evidence"
  | "handoff_required"
  | "temporarily_unavailable"
  | "failed";

export type OutcomeValueType =
  | "boolean" | "string" | "int64" | "decimal" | "timestamp"
  | "duration" | "identifier" | "reference" | "record" | "list" | "map";

export type OutcomeAuthority =
  | "canonical_external" | "canonical" | "owner_asserted"
  | "supporting" | "informational" | "derived" | "proposal";

export type OutcomeFreshnessRequirement = "current" | "allow_aging" | "allow_stale";

export interface OutcomeSlotDefinition {
  id: string;
  label: string;
  value_type: OutcomeValueType;
  critical: boolean;
  acquisition: "user_input" | "evidence" | "operation" | "derived";
  evidence_required: boolean;
  minimum_authority: OutcomeAuthority;
  freshness_required: OutcomeFreshnessRequirement;
}

export interface OutcomeCompletionContract {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  id: string;
  goal: string;
  scope: { purpose: string; domains: string[]; effect: "read_only" | "effectful" };
  outcome_kind: string;
  required_slots: OutcomeSlotDefinition[];
  optional_slots: OutcomeSlotDefinition[];
  completion_policy: { allow_partial: boolean; all_critical_required: true };
  interaction_policy: { max_questions: number; ask_one_at_a_time: boolean };
  conflict_policy: { critical_conflict: "block"; noncritical_conflict: "report" | "block" };
  template_authority: "owner_approved" | "ephemeral_read_only";
  parent_contract_digest?: string;
  execution_allowed: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface OutcomeCandidate {
  id: string;
  slot_id: string;
  value: unknown;
  evidence_refs: string[];
  source_refs: string[];
  provider_ref: string;
}

export interface OutcomeCandidateSet {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  id: string;
  contract_digest: string;
  provider: { id: string; model?: string };
  input_digest: string;
  output_digest: string;
  candidates: OutcomeCandidate[];
  context: {
    purpose: string;
    domains: string[];
    availability: "available" | "temporarily_unavailable" | "failed";
    handoff_required: boolean;
  };
  accepted: false;
  execution_allowed: false;
  content_is_untrusted_data: true;
  canonical_write_allowed: false;
  digest: string;
}

export interface OutcomeEvidenceItem {
  id: string;
  source_ref: string;
  contract_digest: string;
  slot_id: string;
  value_digest: string;
  admission_receipt_digest: string;
  authority: OutcomeAuthority;
  freshness: "current" | "aging" | "stale" | "unknown";
  conflict_refs: string[];
  authorized: boolean;
  digest: string;
}

export interface OutcomeEvidenceSet {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  snapshot_digest: string;
  policy_digest: string;
  items: OutcomeEvidenceItem[];
  partial: boolean;
  limitations: string[];
  canonical_write_allowed: false;
  digest: string;
}

export type OutcomeSlotState =
  | "confirmed" | "missing" | "stale" | "conflicting"
  | "unsupported" | "unauthorized" | "invalid";

export interface OutcomeSlotAssessment {
  slot_id: string;
  state: OutcomeSlotState;
  value?: unknown;
  candidate_refs: string[];
  admitted_evidence_refs: string[];
  source_refs: string[];
  reasons: string[];
  content_is_untrusted_data: true;
}

export interface OutcomeChildBundle {
  contract: OutcomeCompletionContract;
  candidates: OutcomeCandidateSet;
  evidence: OutcomeEvidenceSet;
  assessment: OutcomeAssessment;
}

export interface OutcomeAssessment {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  id: string;
  contract_digest: string;
  parent_contract_digest?: string;
  candidate_set_digest: string;
  evidence_set_digest: string;
  slots: OutcomeSlotAssessment[];
  missing_slots: string[];
  stale_slots: string[];
  conflicting_slots: string[];
  unsupported_slots: string[];
  unauthorized_slots: string[];
  evidence_coverage: number;
  status: OutcomeStatus;
  clarifying_question: string | null;
  next_safe_action: string;
  limitations: string[];
  execution_allowed: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface OutcomeDeliveryPlan {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  id: string;
  assessment_digest: string;
  status: OutcomeStatus;
  confirmed_facts: Array<{ slot_id: string; value: unknown; evidence_refs: string[]; source_refs: string[]; content_is_untrusted_data: true }>;
  gaps: Array<{ slot_id: string; state: OutcomeSlotState; reasons: string[] }>;
  question: string | null;
  useful_next_step: string;
  citations: Array<{ evidence_ref: string; source_ref: string }>;
  handoff_route: string | null;
  limitations: string[];
  execution_allowed: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface OutcomeTemplateProposal {
  contract_version: typeof OUTCOME_CONTRACT_VERSION;
  id: string;
  status: "proposal";
  intent_digest: string;
  proposed_contract: Omit<OutcomeCompletionContract, "digest"> & { digest: string };
  diagnostics: string[];
  owner_approval_required: boolean;
  execution_allowed: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface OutcomeValidationResult { valid: boolean; errors: string[]; warnings: string[] }
