#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { assessOutcome, planOutcomeDelivery } = require("../../dist/cjs/outcome");

const root = path.resolve(__dirname, "../../examples/mirai-outcome-completion-minimal");
const invalidRoot = path.resolve(__dirname, "../../examples/mirai-outcome-completion-invalid");
const seal = (body) => ({ ...body, digest: digestValue(body) });
const write = (name, value) => fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`);
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
const evidence = seal({ contract_version: "1.0.0", snapshot_digest: digestValue("snapshot"), policy_digest: digestValue("policy"), items: [
  { id: "evidence.version", source_ref: "source.package", authority: "owner_asserted", freshness: "current", conflict_refs: [], authorized: true, digest: digestValue("version") },
  { id: "evidence.tests", source_ref: "source.ci", authority: "supporting", freshness: "current", conflict_refs: [], authorized: true, digest: digestValue("tests") },
  { id: "evidence.release-note", source_ref: "source.release-note", authority: "supporting", freshness: "current", conflict_refs: [], authorized: true, digest: digestValue("release-note") }
], partial: false, limitations: ["Synthetic fixture does not establish production readiness."], canonical_write_allowed: false });
const candidates = seal({ contract_version: "1.0.0", id: "candidates.release-readiness", contract_digest: contract.digest, provider: { id: "fixture.provider" }, input_digest: digestValue("input"), output_digest: digestValue("output"), candidates: [
  { id: "candidate.version", slot_id: "version", value: "2.5.0-alpha.1", evidence_refs: ["evidence.version"], source_refs: ["source.package"], provider_ref: "fixture.provider" },
  { id: "candidate.tests", slot_id: "test_status", value: "passed", evidence_refs: ["evidence.tests"], source_refs: ["source.ci"], provider_ref: "fixture.provider" },
  { id: "candidate.note", slot_id: "release_note", value: "releases/2.5.0-alpha.1.md", evidence_refs: ["evidence.release-note"], source_refs: ["source.release-note"], provider_ref: "fixture.provider" }
], context: { purpose: "release_review", domains: ["software"], availability: "available", handoff_required: false }, accepted: false, execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false });
const assessment = assessOutcome(contract, candidates, evidence);
const delivery = planOutcomeDelivery(assessment);

write("outcome-contract.json", contract);
write("candidate-set.json", candidates);
write("evidence-set.json", evidence);
write("assessment.json", assessment);
write("delivery-plan.json", delivery);

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
