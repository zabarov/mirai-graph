import { digestValue } from "../core/index.js";
import type { PureAdapterRegistry } from "../runtime/pure-adapters.js";
import { aggregateOutcomes, assessOutcome, planOutcomeDelivery, proposeOutcomeTemplate } from "./assessment.js";
import type { OutcomeAssessment, OutcomeAssessmentVerifier, OutcomeCandidateSet, OutcomeChildBundle, OutcomeCompletionContract, OutcomeEvidenceAdmissionVerifier, OutcomeEvidenceSet } from "./types.js";
import { assertOutcomeCandidateSet, assertOutcomeContract } from "./validator.js";

const operations = ["outcome.aggregate", "outcome.assess", "outcome.bind_candidates", "outcome.instantiate", "outcome.plan_delivery"] as const;
const catalogBody = { contract_version: "1.0.0" as const, id: "mirai.outcome", operations: operations.map((id) => ({ id, version: "1.0.0", effect: "pure", execution_allowed: false, canonical_write_allowed: false })) };
const catalog = { ...catalogBody, digest: digestValue(catalogBody) };

export function outcomeOperationCatalog(): typeof catalog { return structuredClone(catalog); }

export function invokeOutcomeOperation(id: typeof operations[number], args: Record<string, unknown>, expectedCatalogDigest: string, verifyAdmission: OutcomeEvidenceAdmissionVerifier, verifyAssessment: OutcomeAssessmentVerifier): unknown {
  if (expectedCatalogDigest !== catalog.digest) throw new Error("outcome_operation_catalog_digest_mismatch");
  if (!operations.includes(id)) throw new Error("unknown_outcome_operation");
  if (id === "outcome.instantiate") { assertOutcomeContract(args.contract as OutcomeCompletionContract); return structuredClone(args.contract); }
  if (id === "outcome.bind_candidates") { assertOutcomeCandidateSet(args.candidates as OutcomeCandidateSet); return structuredClone(args.candidates); }
  if (id === "outcome.assess") return assessOutcome(args.contract as OutcomeCompletionContract, args.candidates as OutcomeCandidateSet, args.evidence as OutcomeEvidenceSet, verifyAdmission);
  if (id === "outcome.aggregate") return aggregateOutcomes(args.contract as OutcomeCompletionContract, args.child_bundles as OutcomeChildBundle[], verifyAdmission);
  return planOutcomeDelivery(args.assessment as OutcomeAssessment, verifyAssessment, typeof args.handoff_route === "string" ? args.handoff_route : null);
}

export function createOutcomePureAdapters(expectedCatalogDigest: string, verifyAdmission: OutcomeEvidenceAdmissionVerifier): PureAdapterRegistry {
  if (expectedCatalogDigest !== catalog.digest) throw new Error("outcome_operation_catalog_digest_mismatch");
  if (typeof verifyAdmission !== "function") throw new Error("outcome_evidence_admission_verifier_required");
  const verifiedAssessments = new Set<string>();
  const verifyAssessment: OutcomeAssessmentVerifier = (assessment) => verifiedAssessments.has(assessment.digest);
  return { mirai_outcome: Object.fromEntries(operations.map((id) => [id, (args: Record<string, unknown>) => {
    const result = invokeOutcomeOperation(id, args, expectedCatalogDigest, verifyAdmission, verifyAssessment);
    if ((id === "outcome.assess" || id === "outcome.aggregate") && result && typeof result === "object" && "digest" in result) verifiedAssessments.add(String((result as { digest: unknown }).digest));
    return result;
  }])) };
}

export { proposeOutcomeTemplate };
