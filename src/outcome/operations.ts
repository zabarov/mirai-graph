import { digestValue } from "../core/index.js";
import type { PureAdapterRegistry } from "../runtime/pure-adapters.js";
import { aggregateOutcomes, assessOutcome, planOutcomeDelivery, proposeOutcomeTemplate } from "./assessment.js";
import type { OutcomeAssessment, OutcomeCandidateSet, OutcomeCompletionContract, OutcomeEvidenceSet } from "./types.js";
import { assertOutcomeContract } from "./validator.js";

const operations = ["outcome.aggregate", "outcome.assess", "outcome.bind_candidates", "outcome.instantiate", "outcome.plan_delivery"] as const;
const catalogBody = { contract_version: "1.0.0" as const, id: "mirai.outcome", operations: operations.map((id) => ({ id, version: "1.0.0", effect: "pure", execution_allowed: false, canonical_write_allowed: false })) };
const catalog = { ...catalogBody, digest: digestValue(catalogBody) };

export function outcomeOperationCatalog(): typeof catalog { return structuredClone(catalog); }

export function invokeOutcomeOperation(id: typeof operations[number], args: Record<string, unknown>, expectedCatalogDigest: string): unknown {
  if (expectedCatalogDigest !== catalog.digest) throw new Error("outcome_operation_catalog_digest_mismatch");
  if (!operations.includes(id)) throw new Error("unknown_outcome_operation");
  if (id === "outcome.instantiate") { assertOutcomeContract(args.contract as OutcomeCompletionContract); return structuredClone(args.contract); }
  if (id === "outcome.bind_candidates") return structuredClone(args.candidates);
  if (id === "outcome.assess") return assessOutcome(args.contract as OutcomeCompletionContract, args.candidates as OutcomeCandidateSet, args.evidence as OutcomeEvidenceSet);
  if (id === "outcome.aggregate") return aggregateOutcomes(args.contract as OutcomeCompletionContract, args.assessments as OutcomeAssessment[]);
  return planOutcomeDelivery(args.assessment as OutcomeAssessment, typeof args.handoff_route === "string" ? args.handoff_route : null);
}

export function createOutcomePureAdapters(expectedCatalogDigest: string): PureAdapterRegistry {
  if (expectedCatalogDigest !== catalog.digest) throw new Error("outcome_operation_catalog_digest_mismatch");
  return { mirai_outcome: Object.fromEntries(operations.map((id) => [id, (args: Record<string, unknown>) => invokeOutcomeOperation(id, args, expectedCatalogDigest)])) };
}

export { proposeOutcomeTemplate };
