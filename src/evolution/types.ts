import type { AliasRule, KnowledgeAssertion, KnowledgeBudgets, KnowledgeProposal } from "../knowledge/types.js";
import type { NormalizedUnit } from "../sources/types.js";
import type { ProcessCandidate, ProcessObservation } from "../technology/types.js";
import type { AutonomyEnvelope, EvolutionDecision, EvolutionProposal, PromotionReceipt } from "../autonomy/types.js";

export const AUTONOMIC_CYCLE_CONTRACT_VERSION = "1.0.0" as const;

export interface AutonomicCycleInput {
  id: string;
  scope: string;
  observed_at: string;
  source_snapshot_refs: Array<{ source_id: string; snapshot_digest: string }>;
  units: NormalizedUnit[];
  observations: ProcessObservation[];
  aliases?: AliasRule[];
  previous_assertions?: KnowledgeAssertion[];
  known_identities?: string[];
  knowledge_budgets?: Partial<KnowledgeBudgets>;
  base_state_digest: string;
  evolution_evidence_refs: string[];
  envelope?: AutonomyEnvelope;
}

export interface AutonomicCycleResult {
  contract_version: typeof AUTONOMIC_CYCLE_CONTRACT_VERSION;
  id: string;
  scope: string;
  observed_at: string;
  source_snapshot_refs: Array<{ source_id: string; snapshot_digest: string }>;
  knowledge: {
    proposal_digest: string;
    assertion_count: number;
    relation_count: number;
    conflict_count: number;
    readiness: KnowledgeProposal["quality"]["readiness"];
  };
  processes: {
    candidates: ProcessCandidate[];
    intended_count: number;
    observed_count: number;
    draft_allowed_count: number;
  };
  evolution_proposal: EvolutionProposal;
  evolution_decision?: EvolutionDecision;
  promotion_receipt?: PromotionReceipt;
  status: "planned" | "manual_review_required" | "denied" | "applied" | "no_changes";
  canonical_write_allowed: false;
  digest: string;
}
