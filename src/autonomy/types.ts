export const AUTONOMY_ENVELOPE_CONTRACT_VERSION = "1.0.0" as const;
export const EVOLUTION_PROPOSAL_CONTRACT_VERSION = "1.0.0" as const;
export const EVOLUTION_DECISION_CONTRACT_VERSION = "1.0.0" as const;
export const PROMOTION_RECEIPT_CONTRACT_VERSION = "1.0.0" as const;
export const AUTONOMY_AUTHORIZATION_CONTRACT_VERSION = "1.0.0" as const;

export type TrustStratum = "system_protected" | "organization_protected" | "governed_canonical" | "adaptive_canonical" | "ephemeral";
export type EvolutionRisk = "low" | "medium" | "high" | "critical";
export type AdaptiveChangeKind = "source_freshness" | "derived_navigation" | "reviewed_alias" | "adaptive_statistic" | "effect_free_program";

export interface AutonomyEnvelope {
  contract_version: typeof AUTONOMY_ENVELOPE_CONTRACT_VERSION;
  id: string;
  scope: string;
  allowed_change_kinds: AdaptiveChangeKind[];
  forbidden_targets: string[];
  risk_ceiling: "low" | "medium";
  confidence_floor: number;
  evidence_requirements: string[];
  replay_requirements: { required_for: AdaptiveChangeKind[]; minimum_successful_replays: number };
  resource_patterns: string[];
  change_budget: { max_changes: number; max_payload_bytes: number };
  issued_at: string;
  expires_at: string;
  rollback_contract: { required: true; retention_ms: number; verify_readback: true };
  policy_digest: string;
  approver_signatures: Array<{ signer_ref: string; signature_ref: string; signature_digest: string }>;
  canonical_write_allowed: false;
  digest: string;
}

export interface EvolutionChange {
  id: string;
  kind: AdaptiveChangeKind | "protected_invariant" | "authority" | "capability" | "approval" | "conflict_resolution" | "effectful_program" | "history_deletion" | "autonomy_envelope";
  target_ref: string;
  stratum: TrustStratum;
  operation: "upsert" | "deprecate";
  payload: Record<string, unknown>;
  payload_digest: string;
  risk: EvolutionRisk;
  confidence: number;
  reversible: boolean;
  effectful: boolean;
  evidence_refs: string[];
  successful_replay_refs: string[];
  conflict_refs: string[];
}

export interface EvolutionProposal {
  contract_version: typeof EVOLUTION_PROPOSAL_CONTRACT_VERSION;
  id: string;
  scope: string;
  base_state_digest: string;
  changes: EvolutionChange[];
  created_from_cycle_ref: string;
  canonical_write_allowed: false;
  digest: string;
}

export interface EvolutionChangeDecision {
  change_id: string;
  verdict: "allow_automatic" | "manual_review" | "deny";
  reason_codes: string[];
}

export interface EvolutionDecision {
  contract_version: typeof EVOLUTION_DECISION_CONTRACT_VERSION;
  proposal_id: string;
  proposal_digest: string;
  envelope_id: string;
  envelope_digest: string;
  evaluated_at: string;
  change_decisions: EvolutionChangeDecision[];
  verdict: "automatic_promotion_allowed" | "manual_review_required" | "denied";
  canonical_write_allowed: false;
  digest: string;
}

export interface AdaptiveRecord {
  kind: AdaptiveChangeKind;
  lifecycle: "active" | "deprecated";
  payload: Record<string, unknown>;
  payload_digest: string;
  proposal_ref: string;
  evidence_refs: string[];
}

export interface AdaptiveState {
  contract_version: "1.0.0";
  scope: string;
  revision: number;
  records: Record<string, AdaptiveRecord>;
  applied_proposal_ids: string[];
  digest: string;
}

export interface PromotionReceipt {
  contract_version: typeof PROMOTION_RECEIPT_CONTRACT_VERSION;
  id: string;
  proposal_id: string;
  proposal_digest: string;
  decision_digest: string;
  envelope_digest: string;
  state_ref: string;
  before_digest: string;
  after_digest: string;
  revision: number;
  status: "applied" | "already_applied" | "rolled_back";
  rollback_ref?: string;
  applied_change_ids: string[];
  applied_at: string;
  readback_verified: boolean;
  canonical_write_allowed: false;
  digest: string;
}

export interface AutonomyAuthorizationReceipt {
  contract_version: typeof AUTONOMY_AUTHORIZATION_CONTRACT_VERSION;
  id: string;
  approved: true;
  envelope_id: string;
  envelope_digest: string;
  scope: string;
  policy_digest: string;
  approved_by: string;
  issued_at: string;
  expires_at: string;
  canonical_write_allowed: false;
  signature_algorithm: "hmac-sha256-local";
  signature: string;
}
