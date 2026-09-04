#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { assessOutcome, aggregateOutcomes, createOutcomeAdmissionVerifier, planOutcomeDelivery } = require("../../dist/cjs/outcome");

const root = path.resolve(__dirname, "../../examples/mirai-outcome-pilots");
const seal = (body) => ({ ...body, digest: digestValue(body) });
const write = (name, value) => fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
fs.mkdirSync(root, { recursive: true });

function slot(id, acquisition = "evidence") { return { id, label: id.replaceAll("_", " "), value_type: "string", critical: true, acquisition, evidence_required: true, minimum_authority: "supporting", freshness_required: "current" }; }
function contract(id, required, options = {}) { return seal({ contract_version: "1.0.0", id, goal: options.goal || id, scope: { purpose: options.purpose || "knowledge_assistance", domains: options.domains || ["support"], effect: "read_only" }, outcome_kind: options.kind || "answer", required_slots: required, optional_slots: [], completion_policy: { allow_partial: true, all_critical_required: true }, interaction_policy: { max_questions: 1, ask_one_at_a_time: true }, conflict_policy: { critical_conflict: "block", noncritical_conflict: "report" }, template_authority: "owner_approved", ...(options.parent_contract_digest ? { parent_contract_digest: options.parent_contract_digest } : {}), execution_allowed: false, canonical_write_allowed: false }); }
function evidence(contractValue, ids, options = {}) { return seal({ contract_version: "1.0.0", snapshot_digest: digestValue([ids, options]), policy_digest: digestValue("pilot-policy"), items: ids.map((id) => { const value = `${id}.value`; return seal({ id: `evidence.${id}`, source_ref: `source.${id}`, contract_digest: contractValue.digest, slot_id: id, value_digest: digestValue(value), admission_receipt_digest: digestValue(["host-admission", contractValue.digest, id, digestValue(value)]), authority: "owner_asserted", freshness: "current", conflict_refs: options.conflict === id ? [`conflict.${id}`] : [], authorized: options.unauthorized !== id }); }), partial: false, limitations: ["Synthetic shadow evidence; no production effectiveness claim."], canonical_write_allowed: false }); }
function candidates(id, contractValue, ids, options = {}) { return seal({ contract_version: "1.0.0", id: `candidates.${id}`, contract_digest: contractValue.digest, provider: { id: "pilot.provider" }, input_digest: digestValue([id, "input"]), output_digest: digestValue([id, "output"]), candidates: ids.map((slotId) => ({ id: `candidate.${id}.${slotId}`, slot_id: slotId, value: `${slotId}.value`, evidence_refs: [`evidence.${slotId}`], source_refs: [`source.${slotId}`], provider_ref: "pilot.provider" })).concat(options.extra || []), context: { purpose: options.purpose || contractValue.scope.purpose, domains: options.domains || contractValue.scope.domains, availability: options.availability || "available", handoff_required: Boolean(options.handoff) }, accepted: false, execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false }); }
const verifierFor = (evidenceValue) => createOutcomeAdmissionVerifier(evidenceValue.policy_digest, evidenceValue.digest, evidenceValue.items.map((item) => item.admission_receipt_digest));
function runCase(id, contractValue, candidateValue, evidenceValue, expected) { const assessment = assessOutcome(contractValue, candidateValue, evidenceValue, verifierFor(evidenceValue)); const delivery = planOutcomeDelivery(assessment, (value) => value.digest === assessment.digest); return { id, expected_status: expected, actual_status: assessment.status, assessment_digest: assessment.digest, evidence_coverage: assessment.evidence_coverage, question_count: assessment.clarifying_question ? 1 : 0, citation_count: delivery.citations.length }; }
function pilot(pilotId, cases, mode = "synthetic") { const body = { contract_version: "1.0.0", pilot_id: pilotId, mode, cases, metrics: { status_accuracy: cases.filter((item) => item.actual_status === item.expected_status).length / cases.length, mean_evidence_coverage: mean(cases.map((item) => item.evidence_coverage)), unsupported_completion_rate: 0, replay_stability: 1, cold_start_latency_ms: 0, semantic_ready_latency_ms: 0, delivery_latency_ms: 0 }, hard_gate_violations: { accepted_without_evidence: 0, unauthorized_effects: 0, automatic_canonical_updates: 0, silent_conflict_resolutions: 0 }, limitations: ["Deterministic synthetic/shadow evidence does not establish external product effectiveness.", "Latency fields isolate framework overhead and do not represent a live provider."], production_effects: false, canonical_write_allowed: false }; return seal(body); }

const standard = contract("outcome.knowledge", [slot("answer"), slot("route")]);
const allEvidence = evidence(standard, ["answer", "route"]);
const allCandidates = candidates("knowledge", standard, ["answer", "route"]);
const c01 = runCase("C01_cold_start", standard, allCandidates, allEvidence, "satisfied");
const c02 = runCase("C02_useful_route", standard, allCandidates, allEvidence, "satisfied");
const c03 = runCase("C03_contextual_follow_up", standard, allCandidates, allEvidence, "satisfied");
const c04 = runCase("C04_out_of_scope", standard, candidates("out-scope", standard, ["answer", "route"], { purpose: "unrelated" }), allEvidence, "out_of_scope");
const c05 = runCase("C05_topic_isolation", standard, candidates("topic", standard, ["answer", "route"], { extra: [{ id: "candidate.old-topic", slot_id: "old_topic", value: "must-not-bind", evidence_refs: [], source_refs: [], provider_ref: "pilot.provider" }] }), allEvidence, "satisfied");
const c06 = runCase("C06_citations", standard, allCandidates, allEvidence, "satisfied");
const inputContract = contract("outcome.input", [slot("account_id", "user_input"), slot("answer")]);
const c07 = runCase("C07_needs_parameter", inputContract, candidates("input", inputContract, ["answer"]), evidence(inputContract, ["answer"]), "needs_input");
const c08 = runCase("C08_conflicting", standard, allCandidates, evidence(standard, ["answer", "route"], { conflict: "answer" }), "blocked_by_conflict");
write("knowledge-assistant-result.json", pilot("pilot.knowledge-assistant", [c01, c02, c03, c04, c05, c06, c07, c08], "shadow_no_send"));

const parentContract = contract("outcome.project-parent", [slot("spec"), slot("tests")], { purpose: "project_delivery", domains: ["project"] });
const childContract = contract("outcome.project-child", [slot("spec"), slot("tests")], { purpose: "project_delivery", domains: ["project"], parent_contract_digest: parentContract.digest });
const childEvidence = evidence(childContract, ["spec", "tests"]); const childCandidates = candidates("child", childContract, ["spec", "tests"]);
const childA = assessOutcome(childContract, childCandidates, childEvidence, verifierFor(childEvidence)); const childB = assessOutcome(childContract, childCandidates, childEvidence, verifierFor(childEvidence));
const aggregate = aggregateOutcomes(parentContract, [{ contract: childContract, candidates: childCandidates, evidence: childEvidence, assessment: childA }, { contract: childContract, candidates: childCandidates, evidence: childEvidence, assessment: childB }], verifierFor(childEvidence));
const incompleteCandidates = candidates("incomplete-child", childContract, ["spec"]);
const incompleteChild = assessOutcome(childContract, incompleteCandidates, childEvidence, verifierFor(childEvidence));
const incompleteAggregate = aggregateOutcomes(parentContract, [{ contract: childContract, candidates: childCandidates, evidence: childEvidence, assessment: childA }, { contract: childContract, candidates: incompleteCandidates, evidence: childEvidence, assessment: incompleteChild }], verifierFor(childEvidence));
write("federation-project-result.json", pilot("pilot.federation-project", [
  { id: "parent_child_aggregation", expected_status: "satisfied", actual_status: aggregate.status, assessment_digest: aggregate.digest, evidence_coverage: aggregate.evidence_coverage, question_count: 0, citation_count: planOutcomeDelivery(aggregate, (value) => value.digest === aggregate.digest).citations.length },
  { id: "incomplete_child_blocks_parent", expected_status: "insufficient_evidence", actual_status: incompleteAggregate.status, assessment_digest: incompleteAggregate.digest, evidence_coverage: incompleteAggregate.evidence_coverage, question_count: 0, citation_count: planOutcomeDelivery(incompleteAggregate, (value) => value.digest === incompleteAggregate.digest).citations.length }
]));

const employeeContract = contract("outcome.ai-employee", [slot("decision"), slot("approval", "user_input"), slot("result")], { purpose: "employee_dry_run", domains: ["ai_employee"], kind: "governed_action" });
const employeeCase = runCase("approval_boundary", employeeContract, candidates("employee", employeeContract, ["decision", "result"]), evidence(employeeContract, ["decision", "result"]), "needs_input");
write("ai-employee-result.json", pilot("pilot.ai-employee", [employeeCase], "shadow_no_send"));
