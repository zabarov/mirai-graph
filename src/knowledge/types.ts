import type { Confidentiality, NormalizedUnit, SourceAuthority } from "../sources/types.js";

export const KNOWLEDGE_ASSERTION_CONTRACT_VERSION = "1.0.0" as const;
export const KNOWLEDGE_PROPOSAL_CONTRACT_VERSION = "1.0.0" as const;

export type KnowledgeLifecycle = "observed" | "candidate" | "accepted" | "active" | "stale" | "superseded" | "deprecated" | "tombstoned";
export type SourceState = "available" | "source_missing";

export interface KnowledgeQualityVector {
  extraction_confidence: number;
  source_authority: SourceAuthority;
  corroboration_count: number;
  freshness: "current" | "aging" | "stale" | "unknown";
  conflict_state: "none" | "duplicate" | "conflicting" | "ambiguous_identity";
}

export interface KnowledgeAssertion {
  contract_version: typeof KNOWLEDGE_ASSERTION_CONTRACT_VERSION;
  id: string;
  identity_key: string;
  semantic_type: string;
  label: string;
  predicate: string;
  value: unknown;
  value_digest: string;
  scope: string;
  confidentiality: Confidentiality;
  valid_from?: string;
  valid_until?: string;
  quality: KnowledgeQualityVector;
  provenance: Array<{ source_ref: string; source_fingerprint: string; content_digest: string }>;
  lifecycle: KnowledgeLifecycle;
  source_state: SourceState;
  authority_decision_required: boolean;
  canonical_write_allowed: false;
}

export interface AliasRule {
  alias: string;
  canonical_identity: string;
  scope: string;
  reviewed: true;
  approval_ref: string;
}

export interface IdentityResolution {
  candidate_identity: string;
  resolution: "exact" | "reviewed_alias" | "ambiguous" | "new_identity";
  canonical_identity?: string;
  candidate_matches: string[];
  owner_review_required: boolean;
}

export interface ConflictFamily {
  id: string;
  identity_key: string;
  predicate: string;
  assertion_ids: string[];
  value_digests: string[];
  resolution: "owner_review_required";
}

export interface KnowledgeRelationFact {
  id: string;
  type: string;
  participants: Array<{ ref: string; role: string }>;
  qualifiers: Record<string, unknown>;
  scope: string;
  authority: SourceAuthority;
  confidence: number;
  provenance: Array<{ source_ref: string }>;
  lifecycle: KnowledgeLifecycle;
}

export interface KnowledgeBudgets {
  max_units: number;
  max_assertions: number;
  max_relations: number;
  max_conflicts: number;
}

export interface KnowledgeProposal {
  contract_version: typeof KNOWLEDGE_PROPOSAL_CONTRACT_VERSION;
  assertions: KnowledgeAssertion[];
  identity_resolutions: IdentityResolution[];
  exact_duplicate_groups: Array<{ value_digest: string; assertion_ids: string[] }>;
  conflicts: ConflictFamily[];
  relation_facts: KnowledgeRelationFact[];
  stale_assertion_ids: string[];
  diagnostics: Array<{ code: string; severity: "info" | "warning" | "blocking"; message: string; assertion_refs?: string[] }>;
  quality: {
    provenance_coverage: number;
    conflict_count: number;
    ambiguous_identity_count: number;
    proposal_noise_ratio: number;
    readiness: "ready_for_review" | "blocked";
  };
  budgets: KnowledgeBudgets;
  growth_control?: {
    status: "partitioning_required" | "pruning_review_required";
    dimension: "units" | "assertions" | "relations" | "conflicts";
    observed: number;
    limit: number;
    suggested_actions: Array<"partition_by_source_scope" | "partition_by_fingerprint_prefix" | "review_exact_duplicates" | "review_stale_and_superseded">;
    automatic_pruning_allowed: false;
    proposal_only: true;
  };
  canonical_write_allowed: false;
  next_safe_action: "owner_review" | "resolve_conflicts" | "reduce_scope" | "partition_source" | "review_pruning";
  digest: string;
}

export interface KnowledgeOrganizationInput {
  units: NormalizedUnit[];
  aliases?: AliasRule[];
  verify_alias_approval?: (alias: AliasRule) => boolean;
  previous_assertions?: KnowledgeAssertion[];
  known_identities?: string[];
  budgets?: Partial<KnowledgeBudgets>;
}

export const DEFAULT_KNOWLEDGE_BUDGETS: KnowledgeBudgets = {
  max_units: 25_000,
  max_assertions: 100_000,
  max_relations: 100_000,
  max_conflicts: 10_000
};
