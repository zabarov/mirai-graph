const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const { digestValue } = require("../../dist/cjs/core");
const outcome = require("../../dist/cjs/outcome");
const { createOutcomeAdmissionVerifier, proposeOutcomeTemplate, validateOutcomeContract } = outcome;
const root = path.resolve(__dirname, "../../examples/mirai-outcome-completion-minimal");
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const seal = (body) => { const { digest: _digest, ...rest } = body; return { ...rest, digest: digestValue(rest) }; };
const verifierFor = (...sets) => {
  const verifiers = new Map(sets.map((set) => [set.digest, createOutcomeAdmissionVerifier(set.policy_digest, set.digest, set.items.map((item) => item.admission_receipt_digest))]));
  return (item, set, contract) => Boolean(verifiers.get(set.digest)?.(item, set, contract));
};
const assessOutcome = (contract, candidates, evidence) => outcome.assessOutcome(contract, candidates, evidence, verifierFor(evidence));
const aggregateOutcomes = (contract, bundles) => outcome.aggregateOutcomes(contract, bundles, verifierFor(...bundles.map((bundle) => bundle.evidence)));
const planOutcomeDelivery = (assessment) => outcome.planOutcomeDelivery(assessment, (value) => value.digest === assessment.digest);

test("public outcome schemas accept deterministic reference artifacts", () => {
  const pairs = [["outcome-completion-contract.schema.json", "outcome-contract.json"], ["outcome-candidate-set.schema.json", "candidate-set.json"], ["outcome-evidence-set.schema.json", "evidence-set.json"], ["outcome-assessment.schema.json", "assessment.json"], ["outcome-delivery-plan.schema.json", "delivery-plan.json"]];
  for (const [schemaName, valueName] of pairs) {
    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const validate = ajv.compile(JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", schemaName), "utf8")));
    assert.equal(validate(load(valueName)), true, `${schemaName}: ${JSON.stringify(validate.errors)}`);
  }
});

test("Task Plan remains backward compatible and accepts optional outcome binding", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas/task-plan.schema.json"), "utf8"));
  const validate = ajv.compile(schema);
  const legacy = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-task-runtime-minimal/task-plan.json"), "utf8"));
  assert.equal(validate(legacy), true, JSON.stringify(validate.errors));
  const extended = structuredClone(legacy);
  extended.requests[0].outcome_contract_ref = "mirai/outcomes/review.json";
  extended.requests[0].outcome_contract_digest = load("outcome-contract.json").digest;
  assert.equal(validate(extended), true, JSON.stringify(validate.errors));
});

test("all critical slots with admitted evidence produce satisfied and cited delivery", () => {
  const contract = load("outcome-contract.json");
  const assessment = assessOutcome(contract, load("candidate-set.json"), load("evidence-set.json"));
  assert.equal(validateOutcomeContract(contract).valid, true);
  assert.equal(assessment.status, "satisfied");
  assert.equal(assessment.evidence_coverage, 1);
  const delivery = planOutcomeDelivery(assessment);
  assert.equal(delivery.confirmed_facts.length, 3);
  assert.equal(delivery.citations.length, 3);
  assert.equal(delivery.execution_allowed, false);
  assert.equal(delivery.canonical_write_allowed, false);
});

test("candidate without admitted evidence cannot claim satisfied", () => {
  const evidence = load("evidence-set.json"); evidence.items = evidence.items.filter((item) => item.id !== "evidence.tests");
  const assessment = assessOutcome(load("outcome-contract.json"), load("candidate-set.json"), seal(evidence));
  assert.equal(assessment.status, "insufficient_evidence");
  assert.deepEqual(assessment.unsupported_slots, ["test_status"]);
});

test("status precedence handles scope, conflict, input and temporary failure", () => {
  const contract = load("outcome-contract.json");
  const baseCandidates = load("candidate-set.json");
  const baseEvidence = load("evidence-set.json");
  const outOfScope = structuredClone(baseCandidates); outOfScope.context.purpose = "other";
  assert.equal(assessOutcome(contract, seal(outOfScope), baseEvidence).status, "out_of_scope");

  const conflictEvidence = structuredClone(baseEvidence); conflictEvidence.items.find((item) => item.id === "evidence.tests").conflict_refs = ["conflict.tests"]; conflictEvidence.items = conflictEvidence.items.map(seal);
  assert.equal(assessOutcome(contract, baseCandidates, seal(conflictEvidence)).status, "blocked_by_conflict");

  let inputContract = structuredClone(contract); inputContract.required_slots[0].acquisition = "user_input"; inputContract = seal(inputContract);
  const missingInput = structuredClone(baseCandidates); missingInput.contract_digest = inputContract.digest; missingInput.candidates = missingInput.candidates.filter((item) => item.slot_id !== "version");
  const needsInput = assessOutcome(inputContract, seal(missingInput), baseEvidence);
  assert.equal(needsInput.status, "needs_input"); assert.match(needsInput.clarifying_question, /version/);

  const unavailable = structuredClone(baseCandidates); unavailable.context.availability = "temporarily_unavailable";
  assert.equal(assessOutcome(contract, seal(unavailable), baseEvidence).status, "temporarily_unavailable");
});

test("forged, stale and unauthorized evidence fail closed", () => {
  const contract = load("outcome-contract.json"); const candidates = load("candidate-set.json");
  const forged = structuredClone(candidates); forged.candidates[0].evidence_refs = ["evidence.forged"];
  assert.equal(assessOutcome(contract, seal(forged), load("evidence-set.json")).status, "insufficient_evidence");
  const stale = load("evidence-set.json"); stale.items.find((item) => item.id === "evidence.version").freshness = "stale"; stale.items = stale.items.map(seal);
  assert.deepEqual(assessOutcome(contract, candidates, seal(stale)).stale_slots, ["version"]);
  const unauthorized = load("evidence-set.json"); unauthorized.items.find((item) => item.id === "evidence.tests").authorized = false; unauthorized.items = unauthorized.items.map(seal);
  assert.deepEqual(assessOutcome(contract, candidates, seal(unauthorized)).unauthorized_slots, ["test_status"]);
});

test("pure assessment is deterministic across 100 runs", () => {
  const digests = Array.from({ length: 100 }, () => assessOutcome(load("outcome-contract.json"), load("candidate-set.json"), load("evidence-set.json")).digest);
  assert.equal(new Set(digests).size, 1);
});

test("nested aggregation preserves evidence and rejects tampered children", () => {
  const contract = load("outcome-contract.json"); const candidates = load("candidate-set.json"); const evidence = load("evidence-set.json"); const child = load("assessment.json");
  const bundle = { contract, candidates, evidence, assessment: child };
  const aggregate = aggregateOutcomes(contract, [bundle, bundle]);
  assert.equal(aggregate.status, "satisfied");
  assert.deepEqual(aggregate.slots.find((slot) => slot.slot_id === "version").admitted_evidence_refs, ["evidence.version"]);
  assert.equal(aggregate.evidence_set_digest, digestValue([child.evidence_set_digest, child.evidence_set_digest]));
  const conflicting = structuredClone(child);
  const version = conflicting.slots.find((slot) => slot.slot_id === "version");
  version.value = "different";
  conflicting.digest = digestValue(Object.fromEntries(Object.entries(conflicting).filter(([key]) => key !== "digest")));
  assert.throws(() => aggregateOutcomes(contract, [bundle, { ...bundle, assessment: conflicting }]), /child_assessment_invalid/);
  const tampered = structuredClone(child); tampered.status = "failed";
  assert.throws(() => aggregateOutcomes(contract, [{ ...bundle, assessment: tampered }]), /child_assessment_invalid/);
  const forgedCandidates = structuredClone(candidates); forgedCandidates.candidates[0].value = "different";
  assert.throws(() => aggregateOutcomes(contract, [{ contract, candidates: seal(forgedCandidates), evidence, assessment: child }]), /child_assessment_invalid/);
});

test("nested aggregation accepts explicit parent binding and preserves incomplete child status", () => {
  const parent = load("outcome-contract.json");
  const childContract = structuredClone(parent);
  childContract.id = "outcome.release-readiness-child";
  childContract.parent_contract_digest = parent.digest;
  const boundChildContract = seal(childContract);
  const childCandidates = load("candidate-set.json");
  childCandidates.id = "candidates.child";
  childCandidates.contract_digest = boundChildContract.digest;
  const evidence = load("evidence-set.json");
  const reboundEvidence = structuredClone(evidence);
  reboundEvidence.items = reboundEvidence.items.map((item) => seal({ ...item, contract_digest: boundChildContract.digest }));
  const sealedReboundEvidence = seal(reboundEvidence);
  const boundChild = assessOutcome(boundChildContract, seal(childCandidates), sealedReboundEvidence);
  assert.equal(boundChild.parent_contract_digest, parent.digest);
  assert.equal(aggregateOutcomes(parent, [{ contract: boundChildContract, candidates: seal(childCandidates), evidence: sealedReboundEvidence, assessment: boundChild }]).status, "satisfied");

  const unboundContract = seal({ ...childContract, id: "outcome.unbound-child", parent_contract_digest: `sha256:${"a".repeat(64)}` });
  const unboundCandidates = seal({ ...childCandidates, id: "candidates.unbound", contract_digest: unboundContract.digest });
  const unboundEvidence = structuredClone(evidence); unboundEvidence.items = unboundEvidence.items.map((item) => seal({ ...item, contract_digest: unboundContract.digest }));
  const sealedUnboundEvidence = seal(unboundEvidence);
  const unboundChild = assessOutcome(unboundContract, unboundCandidates, sealedUnboundEvidence);
  assert.throws(() => aggregateOutcomes(parent, [{ contract: unboundContract, candidates: unboundCandidates, evidence: sealedUnboundEvidence, assessment: unboundChild }]), /child_assessment_invalid/);

  const incompleteCandidates = structuredClone(childCandidates);
  incompleteCandidates.id = "candidates.incomplete-child";
  incompleteCandidates.candidates = incompleteCandidates.candidates.filter((item) => item.slot_id !== "test_status");
  const sealedIncompleteCandidates = seal(incompleteCandidates);
  const incompleteChild = assessOutcome(boundChildContract, sealedIncompleteCandidates, sealedReboundEvidence);
  assert.equal(incompleteChild.status, "insufficient_evidence");
  assert.equal(aggregateOutcomes(parent, [
    { contract: boundChildContract, candidates: seal(childCandidates), evidence: sealedReboundEvidence, assessment: boundChild },
    { contract: boundChildContract, candidates: sealedIncompleteCandidates, evidence: sealedReboundEvidence, assessment: incompleteChild }
  ]).status, "insufficient_evidence");
});

test("evidence is bound to the admitted contract, slot and candidate value", () => {
  const contract = load("outcome-contract.json"); const evidence = load("evidence-set.json");
  const candidates = load("candidate-set.json"); candidates.candidates[0].value = "laundered-value";
  const assessment = assessOutcome(contract, seal(candidates), evidence);
  assert.equal(assessment.status, "insufficient_evidence");
  assert.deepEqual(assessment.unsupported_slots, ["version"]);

  const crossSlot = load("evidence-set.json");
  const versionEvidence = crossSlot.items.find((item) => item.id === "evidence.version");
  versionEvidence.slot_id = "test_status";
  crossSlot.items = crossSlot.items.map(seal);
  assert.deepEqual(assessOutcome(contract, load("candidate-set.json"), seal(crossSlot)).unsupported_slots, ["version"]);

  const malformed = load("evidence-set.json");
  malformed.items[0].admission_receipt_digest = "not-a-digest";
  malformed.items = malformed.items.map(seal);
  assert.throws(() => assessOutcome(contract, load("candidate-set.json"), seal(malformed)), /outcome_evidence_item_invalid/);
});

test("serialized evidence cannot admit itself without a host verifier", () => {
  const contract = load("outcome-contract.json");
  const candidates = load("candidate-set.json");
  const evidence = load("evidence-set.json");
  assert.throws(() => outcome.assessOutcome(contract, candidates, evidence), /outcome_evidence_admission_verifier_required/);

  const forged = structuredClone(evidence);
  forged.items[0].admission_receipt_digest = digestValue("forged-receipt");
  forged.items = forged.items.map(seal);
  const forgedSet = seal(forged);
  const assessment = outcome.assessOutcome(contract, candidates, forgedSet, verifierFor(evidence));
  assert.deepEqual(assessment.unsupported_slots, ["release_note", "test_status", "version"]);
});

test("child contracts cannot weaken parent evidence policy", () => {
  const parent = load("outcome-contract.json");
  const bundle = load("child-bundle.json");
  bundle.contract.required_slots.find((slot) => slot.id === "version").minimum_authority = "proposal";
  bundle.contract = seal(bundle.contract);
  assert.throws(() => aggregateOutcomes(parent, [bundle]), /outcome_child_policy_weakened/);
});

test("delivery requires a host-verified assessment", () => {
  const assessment = load("assessment.json");
  const forged = seal({ ...assessment, status: "satisfied", evidence_coverage: 0 });
  assert.throws(() => outcome.planOutcomeDelivery(forged, (value) => value.digest === assessment.digest), /outcome_assessment_verifier_required/);
});

test("untrusted content label survives assessment and delivery", () => {
  const assessment = assessOutcome(load("outcome-contract.json"), load("candidate-set.json"), load("evidence-set.json"));
  assert.equal(assessment.slots.every((slot) => slot.content_is_untrusted_data === true), true);
  assert.equal(planOutcomeDelivery(assessment).confirmed_facts.every((fact) => fact.content_is_untrusted_data === true), true);
});

test("template proposal remains read-only and owner-review-bound", () => {
  const proposal = proposeOutcomeTemplate({ goal: "Answer policy question", purpose: "policy_lookup", domains: ["governance"], required_context_slots: ["policy", "effective_date"] });
  assert.equal(proposal.status, "proposal"); assert.equal(proposal.owner_approval_required, true);
  assert.equal(proposal.proposed_contract.template_authority, "ephemeral_read_only");
  assert.equal(proposal.execution_allowed, false); assert.equal(proposal.canonical_write_allowed, false);
});

test("effectful ephemeral contract is rejected", () => {
  const contract = load("outcome-contract.json"); contract.template_authority = "ephemeral_read_only"; contract.scope.effect = "effectful";
  const sealedContract = seal(contract);
  assert.equal(validateOutcomeContract(sealedContract).valid, false);
  const candidates = load("candidate-set.json"); candidates.contract_digest = sealedContract.digest;
  assert.throws(() => assessOutcome(sealedContract, seal(candidates), load("evidence-set.json")), /ephemeral_contract_must_be_read_only/);
});

test("critical completion cannot opt out of evidence and malformed inputs fail closed", () => {
  const contract = load("outcome-contract.json");
  contract.required_slots[0].evidence_required = false;
  const weakened = seal(contract);
  assert.match(validateOutcomeContract(weakened).errors.join(","), /critical_slot_requires_evidence/);
  const candidates = load("candidate-set.json");
  candidates.contract_digest = weakened.digest;
  assert.throws(() => assessOutcome(weakened, seal(candidates), load("evidence-set.json")), /critical_slot_requires_evidence/);

  const malformed = load("candidate-set.json");
  malformed.candidates = null;
  assert.throws(() => assessOutcome(load("outcome-contract.json"), seal(malformed), load("evidence-set.json")), /candidate_set_invalid/);
});

test("a contract without a critical evidence slot cannot declare completion", () => {
  const contract = load("outcome-contract.json");
  for (const slot of [...contract.required_slots, ...contract.optional_slots]) {
    slot.critical = false;
    slot.evidence_required = false;
  }
  const weakened = seal(contract);
  assert.match(validateOutcomeContract(weakened).errors.join(","), /critical_evidence_required_slot_missing/);
  const candidates = load("candidate-set.json");
  candidates.contract_digest = weakened.digest;
  assert.throws(() => outcome.assessOutcome(weakened, seal(candidates), load("evidence-set.json"), verifierFor(load("evidence-set.json"))), /critical_evidence_required_slot_missing/);
});
