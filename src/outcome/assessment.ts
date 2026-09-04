import { digestValue, withoutDigest } from "../core/index.js";
import type {
  OutcomeAssessment,
  OutcomeCandidateSet,
  OutcomeCompletionContract,
  OutcomeDeliveryPlan,
  OutcomeEvidenceItem,
  OutcomeEvidenceSet,
  OutcomeSlotAssessment,
  OutcomeSlotDefinition,
  OutcomeStatus,
  OutcomeTemplateProposal
} from "./types.js";
import { assertOutcomeCandidateSet, assertOutcomeContract, assertOutcomeEvidenceSet } from "./validator.js";

const authorityRank: Record<string, number> = {
  proposal: 0, derived: 1, informational: 2, supporting: 3,
  owner_asserted: 4, canonical: 5, canonical_external: 6
};
const freshnessRank: Record<string, number> = { unknown: 0, stale: 1, aging: 2, current: 3 };
const requiredFreshness: Record<string, number> = { allow_stale: 1, allow_aging: 2, current: 3 };

function seal<T extends Record<string, unknown>>(body: T): T & { digest: string } {
  return { ...body, digest: digestValue(body) };
}

function sameDigest(value: { digest: string }): boolean {
  return value.digest === digestValue(withoutDigest(value as unknown as Record<string, unknown>));
}

function unique(values: string[]): string[] { return [...new Set(values)].sort(); }

function validValue(type: OutcomeSlotDefinition["value_type"], value: unknown): boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string" || type === "identifier" || type === "reference" || type === "timestamp" || type === "duration") return typeof value === "string" && value.length > 0;
  if (type === "int64") return Number.isSafeInteger(value);
  if (type === "decimal") return typeof value === "number" && Number.isFinite(value);
  if (type === "list") return Array.isArray(value);
  if (type === "record" || type === "map") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  return false;
}

function evidenceFor(candidateEvidenceRefs: string[], candidateSourceRefs: string[], evidence: OutcomeEvidenceSet): OutcomeEvidenceItem[] {
  return evidence.items.filter((item) => candidateEvidenceRefs.includes(item.id) && candidateSourceRefs.includes(item.source_ref));
}

function assessSlot(slot: OutcomeSlotDefinition, candidates: OutcomeCandidateSet, evidence: OutcomeEvidenceSet): OutcomeSlotAssessment {
  const matches = candidates.candidates.filter((candidate) => candidate.slot_id === slot.id).sort((a, b) => a.id.localeCompare(b.id));
  if (!matches.length) return { slot_id: slot.id, state: "missing", candidate_refs: [], admitted_evidence_refs: [], source_refs: [], reasons: [slot.acquisition === "user_input" ? "user_input_required" : "candidate_missing"] };
  const validCandidates = matches.filter((candidate) => validValue(slot.value_type, candidate.value));
  if (!validCandidates.length) return { slot_id: slot.id, state: "invalid", candidate_refs: matches.map((item) => item.id), admitted_evidence_refs: [], source_refs: [], reasons: ["candidate_value_type_invalid"] };
  const selected = validCandidates[0]!;
  const matchingEvidence = evidenceFor(selected.evidence_refs, selected.source_refs, evidence);
  const authorized = matchingEvidence.filter((item) => item.authorized);
  if (slot.evidence_required && !matchingEvidence.length) return { slot_id: slot.id, state: "unsupported", candidate_refs: [selected.id], admitted_evidence_refs: [], source_refs: selected.source_refs, reasons: ["evidence_reference_not_admitted"] };
  if (slot.evidence_required && !authorized.length) return { slot_id: slot.id, state: "unauthorized", candidate_refs: [selected.id], admitted_evidence_refs: [], source_refs: selected.source_refs, reasons: ["evidence_not_authorized"] };
  const admissible = slot.evidence_required ? authorized : authorized.length ? authorized : matchingEvidence;
  if (slot.evidence_required && !admissible.some((item) => (authorityRank[item.authority] ?? -1) >= (authorityRank[slot.minimum_authority] ?? 99))) return { slot_id: slot.id, state: "unsupported", candidate_refs: [selected.id], admitted_evidence_refs: admissible.map((item) => item.id), source_refs: admissible.map((item) => item.source_ref), reasons: ["authority_below_requirement"] };
  if (admissible.some((item) => item.conflict_refs.length > 0)) return { slot_id: slot.id, state: "conflicting", candidate_refs: [selected.id], admitted_evidence_refs: admissible.map((item) => item.id), source_refs: admissible.map((item) => item.source_ref), reasons: ["admitted_evidence_conflict"] };
  if (slot.evidence_required && !admissible.some((item) => (freshnessRank[item.freshness] ?? -1) >= (requiredFreshness[slot.freshness_required] ?? 99))) return { slot_id: slot.id, state: "stale", candidate_refs: [selected.id], admitted_evidence_refs: admissible.map((item) => item.id), source_refs: admissible.map((item) => item.source_ref), reasons: ["freshness_below_requirement"] };
  const distinctValues = unique(validCandidates.map((item) => JSON.stringify(item.value)));
  if (distinctValues.length > 1) return { slot_id: slot.id, state: "conflicting", candidate_refs: validCandidates.map((item) => item.id), admitted_evidence_refs: admissible.map((item) => item.id), source_refs: admissible.map((item) => item.source_ref), reasons: ["candidate_values_conflict"] };
  return { slot_id: slot.id, state: "confirmed", value: selected.value, candidate_refs: validCandidates.map((item) => item.id), admitted_evidence_refs: unique(admissible.map((item) => item.id)), source_refs: unique(admissible.map((item) => item.source_ref)), reasons: [] };
}

function selectStatus(contract: OutcomeCompletionContract, context: OutcomeCandidateSet["context"], slots: OutcomeSlotAssessment[]): OutcomeStatus {
  if (context.purpose !== contract.scope.purpose || context.domains.some((domain) => !contract.scope.domains.includes(domain))) return "out_of_scope";
  if (context.availability === "failed") return "failed";
  if (context.availability === "temporarily_unavailable") return "temporarily_unavailable";
  if (context.handoff_required) return "handoff_required";
  const definitions = new Map([...contract.required_slots, ...contract.optional_slots].map((slot) => [slot.id, slot]));
  if (slots.some((slot) => slot.state === "conflicting" && (definitions.get(slot.slot_id)?.critical || contract.conflict_policy.noncritical_conflict === "block"))) return "blocked_by_conflict";
  if (slots.some((slot) => slot.state === "missing" && definitions.get(slot.slot_id)?.acquisition === "user_input")) return "needs_input";
  const critical = slots.filter((slot) => definitions.get(slot.slot_id)?.critical);
  if (critical.some((slot) => slot.state !== "confirmed")) return "insufficient_evidence";
  const required = slots.filter((slot) => contract.required_slots.some((requiredSlot) => requiredSlot.id === slot.slot_id));
  if (required.every((slot) => slot.state === "confirmed")) return "satisfied";
  return contract.completion_policy.allow_partial && slots.some((slot) => slot.state === "confirmed") ? "partially_satisfied" : "insufficient_evidence";
}

export function assessOutcome(contract: OutcomeCompletionContract, candidates: OutcomeCandidateSet, evidence: OutcomeEvidenceSet): OutcomeAssessment {
  assertOutcomeContract(contract);
  assertOutcomeCandidateSet(candidates);
  assertOutcomeEvidenceSet(evidence);
  if (candidates.contract_digest !== contract.digest) throw new Error("outcome_candidate_contract_mismatch");
  if (contract.template_authority === "ephemeral_read_only" && contract.scope.effect !== "read_only") throw new Error("ephemeral_outcome_contract_cannot_be_effectful");
  if (contract.parent_contract_digest && contract.template_authority === "ephemeral_read_only") throw new Error("ephemeral_parent_contract_requires_explicit_resolution");
  const slots = [...contract.required_slots, ...contract.optional_slots].map((slot) => assessSlot(slot, candidates, evidence));
  const status = selectStatus(contract, candidates.context, slots);
  const byState = (state: OutcomeSlotAssessment["state"]) => slots.filter((slot) => slot.state === state).map((slot) => slot.slot_id);
  const required = slots.filter((slot) => contract.required_slots.some((item) => item.id === slot.slot_id));
  const questionSlot = slots.find((slot) => slot.state === "missing" && [...contract.required_slots, ...contract.optional_slots].find((item) => item.id === slot.slot_id)?.acquisition === "user_input");
  const body = {
    contract_version: "1.0.0" as const,
    id: `assessment.${contract.id}.${candidates.id}`,
    contract_digest: contract.digest,
    candidate_set_digest: candidates.digest,
    evidence_set_digest: evidence.digest,
    slots,
    missing_slots: byState("missing"), stale_slots: byState("stale"), conflicting_slots: byState("conflicting"),
    unsupported_slots: unique([...byState("unsupported"), ...byState("invalid")]), unauthorized_slots: byState("unauthorized"),
    evidence_coverage: required.length ? required.filter((slot) => slot.state === "confirmed").length / required.length : 1,
    status,
    clarifying_question: status === "needs_input" && questionSlot ? `Please provide ${questionSlot.slot_id}.` : null,
    next_safe_action: status === "satisfied" ? "prepare_delivery" : status === "partially_satisfied" ? "deliver_confirmed_part_and_disclose_gaps" : status === "needs_input" ? "ask_clarifying_question" : status === "handoff_required" ? "handoff_with_confirmed_slots" : "do_not_claim_completion",
    limitations: unique(evidence.limitations), execution_allowed: false as const, canonical_write_allowed: false as const
  };
  return seal(body);
}

export function aggregateOutcomes(contract: OutcomeCompletionContract, assessments: OutcomeAssessment[]): OutcomeAssessment {
  if (!assessments.length) throw new Error("outcome_assessments_required");
  assertOutcomeContract(contract);
  if (assessments.some((item) => item.contract_digest !== contract.digest || !Array.isArray(item.slots) || !Array.isArray(item.limitations) || !sameDigest(item))) throw new Error("outcome_child_assessment_invalid");
  const definitions = [...contract.required_slots, ...contract.optional_slots];
  const severity: OutcomeSlotAssessment["state"][] = ["conflicting", "unauthorized", "stale", "unsupported", "invalid", "missing"];
  const slots = definitions.map((definition): OutcomeSlotAssessment => {
    const children = assessments.flatMap((assessment) => assessment.slots.filter((slot) => slot.slot_id === definition.id));
    const confirmed = children.filter((slot) => slot.state === "confirmed");
    const values = unique(confirmed.map((slot) => JSON.stringify(slot.value)));
    const common = {
      slot_id: definition.id,
      candidate_refs: unique(children.flatMap((slot) => slot.candidate_refs)),
      admitted_evidence_refs: unique(children.flatMap((slot) => slot.admitted_evidence_refs)),
      source_refs: unique(children.flatMap((slot) => slot.source_refs))
    };
    if (values.length > 1 || children.some((slot) => slot.state === "conflicting")) {
      return { ...common, state: "conflicting", reasons: unique(["child_assessments_conflict", ...children.flatMap((slot) => slot.reasons)]) };
    }
    if (confirmed.length) return { ...common, state: "confirmed", value: confirmed[0]!.value, reasons: [] };
    const state = severity.find((candidateState) => children.some((slot) => slot.state === candidateState)) || "missing";
    return { ...common, state, reasons: unique(children.flatMap((slot) => slot.reasons).concat(children.length ? [] : ["child_slot_missing"])) };
  });
  const availability = assessments.some((item) => item.status === "failed") ? "failed" as const
    : assessments.some((item) => item.status === "temporarily_unavailable") ? "temporarily_unavailable" as const
      : "available" as const;
  const context: OutcomeCandidateSet["context"] = {
    purpose: contract.scope.purpose,
    domains: contract.scope.domains,
    availability,
    handoff_required: assessments.some((item) => item.status === "handoff_required")
  };
  const status = selectStatus(contract, context, slots);
  const byState = (state: OutcomeSlotAssessment["state"]) => slots.filter((slot) => slot.state === state).map((slot) => slot.slot_id);
  const required = slots.filter((slot) => contract.required_slots.some((item) => item.id === slot.slot_id));
  const questionSlot = slots.find((slot) => slot.state === "missing" && definitions.find((item) => item.id === slot.slot_id)?.acquisition === "user_input");
  const body = {
    contract_version: "1.0.0" as const,
    id: `assessment.aggregate.${contract.id}`,
    contract_digest: contract.digest,
    candidate_set_digest: digestValue(assessments.map((item) => item.candidate_set_digest)),
    evidence_set_digest: digestValue(assessments.map((item) => item.evidence_set_digest)),
    slots,
    missing_slots: byState("missing"), stale_slots: byState("stale"), conflicting_slots: byState("conflicting"),
    unsupported_slots: unique([...byState("unsupported"), ...byState("invalid")]), unauthorized_slots: byState("unauthorized"),
    evidence_coverage: required.length ? required.filter((slot) => slot.state === "confirmed").length / required.length : 1,
    status,
    clarifying_question: status === "needs_input" && questionSlot ? `Please provide ${questionSlot.slot_id}.` : null,
    next_safe_action: status === "satisfied" ? "prepare_delivery" : status === "partially_satisfied" ? "deliver_confirmed_part_and_disclose_gaps" : status === "needs_input" ? "ask_clarifying_question" : status === "handoff_required" ? "handoff_with_confirmed_slots" : "do_not_claim_completion",
    limitations: unique(assessments.flatMap((item) => item.limitations)),
    execution_allowed: false as const,
    canonical_write_allowed: false as const
  };
  return seal(body);
}

export function planOutcomeDelivery(assessment: OutcomeAssessment, handoffRoute: string | null = null): OutcomeDeliveryPlan {
  if (!sameDigest(assessment)) throw new Error("outcome_assessment_digest_mismatch");
  const confirmed = assessment.slots.filter((slot) => slot.state === "confirmed");
  const body = { contract_version: "1.0.0" as const, id: `delivery.${assessment.id}`, assessment_digest: assessment.digest, status: assessment.status,
    confirmed_facts: confirmed.map((slot) => ({ slot_id: slot.slot_id, value: slot.value, evidence_refs: slot.admitted_evidence_refs, source_refs: slot.source_refs })),
    gaps: assessment.slots.filter((slot) => slot.state !== "confirmed").map((slot) => ({ slot_id: slot.slot_id, state: slot.state, reasons: slot.reasons })),
    question: assessment.clarifying_question, useful_next_step: assessment.next_safe_action,
    citations: unique(confirmed.flatMap((slot) => slot.admitted_evidence_refs.map((ref, index) => `${ref}\u0000${slot.source_refs[index] || slot.source_refs[0] || "source.unknown"}`))).map((pair) => { const [evidence_ref, source_ref] = pair.split("\u0000"); return { evidence_ref: evidence_ref!, source_ref: source_ref! }; }),
    handoff_route: handoffRoute, limitations: assessment.limitations, execution_allowed: false as const, canonical_write_allowed: false as const };
  return seal(body);
}

export function proposeOutcomeTemplate(intent: Record<string, unknown>): OutcomeTemplateProposal {
  const intentDigest = digestValue(intent);
  const goal = typeof intent.goal === "string" ? intent.goal : typeof intent.intent === "string" ? intent.intent : "Complete the requested outcome";
  const purpose = typeof intent.purpose === "string" ? intent.purpose : "read_only_assistance";
  const domains = Array.isArray(intent.domains) ? intent.domains.filter((item): item is string => typeof item === "string") : ["general"];
  const requested = Array.isArray(intent.required_context_slots) ? intent.required_context_slots.filter((item): item is string => typeof item === "string") : [];
  const slots = requested.map((id) => ({ id, label: id.replace(/[_.-]+/g, " "), value_type: "string" as const, critical: true, acquisition: "evidence" as const, evidence_required: true, minimum_authority: "supporting" as const, freshness_required: "allow_aging" as const }));
  const contractBody = { contract_version: "1.0.0" as const, id: `outcome.proposal.${intentDigest.slice(7, 19)}`, goal, scope: { purpose, domains, effect: "read_only" as const }, outcome_kind: "informational",
    required_slots: slots, optional_slots: [], completion_policy: { allow_partial: true, all_critical_required: true as const }, interaction_policy: { max_questions: 1, ask_one_at_a_time: true }, conflict_policy: { critical_conflict: "block" as const, noncritical_conflict: "report" as const }, template_authority: "ephemeral_read_only" as const,
    execution_allowed: false as const, canonical_write_allowed: false as const };
  const proposedContract = seal(contractBody);
  return seal({ contract_version: "1.0.0" as const, id: `proposal.${proposedContract.id}`, status: "proposal" as const, intent_digest: intentDigest, proposed_contract: proposedContract,
    diagnostics: slots.length ? [] : ["required_slots_not_inferred_owner_review_required"], owner_approval_required: true, execution_allowed: false as const, canonical_write_allowed: false as const });
}
