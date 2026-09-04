#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { assessOutcome, aggregateOutcomes, createOutcomeAdmissionVerifier, planOutcomeDelivery } = require("../../dist/cjs/outcome");

const root = path.resolve(__dirname, "../../examples/mirai-outcome-completion-minimal");
const invalidRoot = path.resolve(__dirname, "../../examples/mirai-outcome-completion-invalid");
const seal = (body) => ({ ...body, digest: digestValue(body) });
const write = (name, value) => fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`);
const admissionVerifierFor = (...sets) => {
  const verifiers = new Map(sets.map((set) => [set.digest, createOutcomeAdmissionVerifier(set.policy_digest, set.digest, set.items.map((item) => item.admission_receipt_digest))]));
  return (item, set, contractValue) => Boolean(verifiers.get(set.digest)?.(item, set, contractValue));
};
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(invalidRoot, { recursive: true });

const contract = seal({
  contract_version: "1.0.0", id: "outcome.release-readiness", goal: "Determine whether the package is ready for review",
  scope: { purpose: "release_review", domains: ["software"], effect: "read_only" }, outcome_kind: "readiness_decision",
  required_slots: [
    { id: "version", label: "Package version", value_type: "string", critical: true, acquisition: "evidence", evidence_required: true, minimum_authority: "owner_asserted", freshness_required: "current" },
    { id: "test_status", label: "Test status", value_type: "string", critical: true, acquisition: "operation", evidence_required: true, minimum_authority: "supporting", freshness_required: "current" }
  ],
  optional_slots: [{ id: "release_note", label: "Release note", value_type: "reference", critical: false, acquisition: "evidence", evidence_required: true, minimum_authority: "supporting", freshness_required: "allow_aging" }],
  completion_policy: { allow_partial: true, all_critical_required: true }, interaction_policy: { max_questions: 1, ask_one_at_a_time: true },
  conflict_policy: { critical_conflict: "block", noncritical_conflict: "report" }, template_authority: "owner_approved",
  execution_allowed: false, canonical_write_allowed: false
});
const candidates = seal({ contract_version: "1.0.0", id: "candidates.release-readiness", contract_digest: contract.digest, provider: { id: "fixture.provider" }, input_digest: digestValue("input"), output_digest: digestValue("output"), candidates: [
  { id: "candidate.version", slot_id: "version", value: "2.5.0-rc.1", evidence_refs: ["evidence.version"], source_refs: ["source.package"], provider_ref: "fixture.provider" },
  { id: "candidate.tests", slot_id: "test_status", value: "passed", evidence_refs: ["evidence.tests"], source_refs: ["source.ci"], provider_ref: "fixture.provider" },
  { id: "candidate.note", slot_id: "release_note", value: "releases/2.5.0-rc.1.md", evidence_refs: ["evidence.release-note"], source_refs: ["source.release-note"], provider_ref: "fixture.provider" }
], context: { purpose: "release_review", domains: ["software"], availability: "available", handoff_required: false }, accepted: false, execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false });
const evidenceItem = (id, sourceRef, slotId, value, authority) => seal({ id, source_ref: sourceRef, contract_digest: contract.digest, slot_id: slotId, value_digest: digestValue(value), admission_receipt_digest: digestValue(["host-admission", id, contract.digest, slotId, digestValue(value)]), authority, freshness: "current", conflict_refs: [], authorized: true });
const evidence = seal({ contract_version: "1.0.0", snapshot_digest: digestValue("snapshot"), policy_digest: digestValue("policy"), items: [
  evidenceItem("evidence.version", "source.package", "version", "2.5.0-rc.1", "owner_asserted"),
  evidenceItem("evidence.tests", "source.ci", "test_status", "passed", "supporting"),
  evidenceItem("evidence.release-note", "source.release-note", "release_note", "releases/2.5.0-rc.1.md", "supporting")
], partial: false, limitations: ["Synthetic fixture does not establish production readiness."], canonical_write_allowed: false });
const assessment = assessOutcome(contract, candidates, evidence, admissionVerifierFor(evidence));
const delivery = planOutcomeDelivery(assessment, (value) => value.digest === assessment.digest);

write("outcome-contract.json", contract);
write("candidate-set.json", candidates);
write("evidence-set.json", evidence);
write("assessment.json", assessment);
write("delivery-plan.json", delivery);

const childContract = seal({ ...Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "digest")), id: "outcome.release-readiness-child", parent_contract_digest: contract.digest });
const childCandidates = seal({ ...Object.fromEntries(Object.entries(candidates).filter(([key]) => key !== "digest")), id: "candidates.release-readiness-child", contract_digest: childContract.digest });
const childEvidence = seal({ ...Object.fromEntries(Object.entries(evidence).filter(([key]) => key !== "digest")), items: evidence.items.map((item) => {
  const body = { ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== "digest")), contract_digest: childContract.digest };
  body.admission_receipt_digest = digestValue(["host-admission", body.id, body.contract_digest, body.slot_id, body.value_digest]);
  return seal(body);
}) });
const childAssessment = assessOutcome(childContract, childCandidates, childEvidence, admissionVerifierFor(childEvidence));
const incompleteCandidates = seal({ ...Object.fromEntries(Object.entries(childCandidates).filter(([key]) => key !== "digest")), id: "candidates.release-readiness-child-incomplete", candidates: childCandidates.candidates.filter((item) => item.slot_id !== "test_status") });
const incompleteChildAssessment = assessOutcome(childContract, incompleteCandidates, childEvidence, admissionVerifierFor(childEvidence));
const aggregateAssessment = aggregateOutcomes(contract, [
  { contract: childContract, candidates: childCandidates, evidence: childEvidence, assessment: childAssessment },
  { contract: childContract, candidates: incompleteCandidates, evidence: childEvidence, assessment: incompleteChildAssessment }
], admissionVerifierFor(childEvidence));
write("child-outcome-contract.json", childContract);
write("child-candidate-set.json", childCandidates);
write("child-evidence-set.json", childEvidence);
write("child-assessment.json", childAssessment);
write("incomplete-child-assessment.json", incompleteChildAssessment);
write("aggregate-assessment.json", aggregateAssessment);
write("child-bundle.json", { contract: childContract, candidates: childCandidates, evidence: childEvidence, assessment: childAssessment });
write("incomplete-child-bundle.json", { contract: childContract, candidates: incompleteCandidates, evidence: childEvidence, assessment: incompleteChildAssessment });

const invalid = (name, value) => fs.writeFileSync(path.join(invalidRoot, name), `${JSON.stringify(value, null, 2)}\n`);
const falseSatisfied = structuredClone(assessment);
falseSatisfied.slots.find((slot) => slot.slot_id === "test_status").state = "unsupported";
falseSatisfied.slots.find((slot) => slot.slot_id === "test_status").admitted_evidence_refs = [];
falseSatisfied.unsupported_slots = ["test_status"];
falseSatisfied.evidence_coverage = 0.5;
falseSatisfied.digest = digestValue(Object.fromEntries(Object.entries(falseSatisfied).filter(([key]) => key !== "digest")));
invalid("satisfied-with-missing-critical.json", falseSatisfied);
const forged = structuredClone(assessment);
forged.slots[0].admitted_evidence_refs = ["evidence.forged"];
forged.digest = digestValue(Object.fromEntries(Object.entries(forged).filter(([key]) => key !== "digest")));
invalid("forged-evidence-ref.json", forged);
const effectfulEphemeral = structuredClone(contract);
effectfulEphemeral.template_authority = "ephemeral_read_only";
effectfulEphemeral.scope.effect = "effectful";
effectfulEphemeral.digest = digestValue(Object.fromEntries(Object.entries(effectfulEphemeral).filter(([key]) => key !== "digest")));
invalid("effectful-ephemeral-contract.json", effectfulEphemeral);
const authorityGrant = structuredClone(contract);
authorityGrant.capability_grant = "capability.forbidden";
authorityGrant.digest = digestValue(Object.fromEntries(Object.entries(authorityGrant).filter(([key]) => key !== "digest")));
invalid("contract-grants-capability.json", authorityGrant);
const timeoutAsComplete = structuredClone(assessment);
timeoutAsComplete.status = "satisfied";
timeoutAsComplete.digest = digestValue(Object.fromEntries(Object.entries(timeoutAsComplete).filter(([key]) => key !== "digest")));
invalid("timeout-reported-complete.json", { assessment: timeoutAsComplete, candidate_context: { availability: "temporarily_unavailable" }, expected_error: "status_mismatch" });
