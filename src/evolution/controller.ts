import { digestValue } from "../core/canonical.js";
import { organizeKnowledge } from "../knowledge/organizer.js";
import { discoverProcessCandidates } from "../technology/discovery.js";
import { evaluateEvolutionProposal } from "../autonomy/evaluator.js";
import { applyAdaptiveEvolution } from "../autonomy/promotion.js";
import {
  EVOLUTION_PROPOSAL_CONTRACT_VERSION,
  type AutonomyEnvelope,
  type EvolutionChange,
  type EvolutionProposal,
  type PromotionReceipt
} from "../autonomy/types.js";
import { AUTONOMIC_CYCLE_CONTRACT_VERSION, type AutonomicCycleInput, type AutonomicCycleResult } from "./types.js";

function buildEvolutionProposal(input: AutonomicCycleInput, knowledgeDigest: string, relationFacts: ReturnType<typeof organizeKnowledge>["relation_facts"], staleIds: string[], derivedChangesAllowed: boolean): EvolutionProposal {
  const changes: EvolutionChange[] = [];
  for (const relation of derivedChangesAllowed ? relationFacts : []) {
    const payload = { relation_fact_ref: relation.id, type: relation.type, participants: relation.participants, provenance: relation.provenance };
    changes.push({
      id: `change.${relation.id}`,
      kind: "derived_navigation",
      target_ref: `adaptive/navigation/${relation.id}`,
      stratum: "adaptive_canonical",
      operation: "upsert",
      payload,
      payload_digest: digestValue(payload),
      risk: "low",
      confidence: relation.confidence,
      reversible: true,
      effectful: false,
      evidence_refs: [...input.evolution_evidence_refs, `knowledge:${knowledgeDigest}`].sort(),
      successful_replay_refs: [],
      conflict_refs: []
    });
  }
  for (const assertionId of staleIds) {
    const payload = { assertion_ref: assertionId, freshness: "source_missing", destructive_delete: false };
    changes.push({
      id: `change.freshness.${assertionId}`,
      kind: "source_freshness",
      target_ref: `adaptive/freshness/${assertionId}`,
      stratum: "adaptive_canonical",
      operation: "upsert",
      payload,
      payload_digest: digestValue(payload),
      risk: "low",
      confidence: 1,
      reversible: true,
      effectful: false,
      evidence_refs: [...input.evolution_evidence_refs, `knowledge:${knowledgeDigest}`].sort(),
      successful_replay_refs: [],
      conflict_refs: []
    });
  }
  const candidate = {
    contract_version: EVOLUTION_PROPOSAL_CONTRACT_VERSION,
    id: `evolution.${digestValue({ cycle: input.id, knowledgeDigest, changes: changes.map((item) => item.id) }).slice(7, 23)}`,
    scope: input.scope,
    base_state_digest: input.base_state_digest,
    changes: changes.sort((a, b) => a.id.localeCompare(b.id)),
    created_from_cycle_ref: input.id,
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}

export function planAutonomicCycle(input: AutonomicCycleInput): AutonomicCycleResult {
  const knowledge = organizeKnowledge({
    units: input.units,
    aliases: input.aliases,
    verify_alias_approval: input.verify_alias_approval,
    previous_assertions: input.previous_assertions,
    known_identities: input.known_identities,
    budgets: input.knowledge_budgets
  });
  const candidates = discoverProcessCandidates(input.observations);
  const proposal = buildEvolutionProposal(input, knowledge.digest, knowledge.relation_facts, knowledge.stale_assertion_ids, knowledge.quality.readiness !== "blocked");
  const decision = input.envelope ? evaluateEvolutionProposal(proposal, input.envelope, input.observed_at) : undefined;
  const status = knowledge.quality.readiness === "blocked" ? "manual_review_required" as const
    : !proposal.changes.length ? "no_changes" as const
    : !decision ? "planned" as const
      : decision.verdict === "automatic_promotion_allowed" ? "planned" as const
        : decision.verdict === "denied" ? "denied" as const : "manual_review_required" as const;
  const body = {
    contract_version: AUTONOMIC_CYCLE_CONTRACT_VERSION,
    id: input.id,
    scope: input.scope,
    observed_at: input.observed_at,
    source_snapshot_refs: [...input.source_snapshot_refs].sort((a, b) => a.source_id.localeCompare(b.source_id)),
    knowledge: { proposal_digest: knowledge.digest, assertion_count: knowledge.assertions.length, relation_count: knowledge.relation_facts.length, conflict_count: knowledge.conflicts.length, readiness: knowledge.quality.readiness },
    processes: { candidates, intended_count: candidates.filter((item) => item.mode === "intended").length, observed_count: candidates.filter((item) => item.mode === "observed").length, draft_allowed_count: candidates.filter((item) => item.technology_draft_allowed).length },
    evolution_proposal: proposal,
    ...(decision ? { evolution_decision: decision } : {}),
    status,
    canonical_write_allowed: false as const
  };
  return { ...body, digest: digestValue(body) };
}

export function runAutonomicReconcileOnce(input: AutonomicCycleInput, options: {
  apply?: boolean;
  root?: string;
  state_ref?: string;
  authorization_ref?: string;
  verify_authorization?: (authorizationRef: string, envelope: AutonomyEnvelope) => boolean;
} = {}): AutonomicCycleResult {
  const planned = planAutonomicCycle(input);
  if (!options.apply || !planned.evolution_proposal.changes.length) return planned;
  if (planned.status !== "planned") throw new Error("autonomic_apply_requires_planned_cycle");
  if (!input.envelope || !planned.evolution_decision) throw new Error("autonomic_apply_requires_envelope_decision");
  const receipt: PromotionReceipt = applyAdaptiveEvolution({
    root: options.root || process.cwd(),
    state_ref: options.state_ref || ".mirai/adaptive/state.json",
    proposal: planned.evolution_proposal,
    decision: planned.evolution_decision,
    envelope: input.envelope,
    authorization_ref: options.authorization_ref || "",
    verify_authorization: options.verify_authorization || (() => false),
    applied_at: input.observed_at
  });
  const body = { ...planned, promotion_receipt: receipt, status: receipt.status === "applied" || receipt.status === "already_applied" ? "applied" as const : planned.status };
  const { digest: _digest, ...without } = body;
  return { ...without, digest: digestValue(without) };
}
