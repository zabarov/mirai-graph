import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = path.resolve(import.meta.dirname, "..");
const miraiRoot = process.env.MIRAI_ROOT;
if (!miraiRoot) throw new Error("MIRAI_ROOT_required");
const require = createRequire(import.meta.url);
const { assessOutcome, planOutcomeDelivery } = require(path.join(miraiRoot, "dist/cjs/outcome/index.js"));
const { digestValue } = require(path.join(miraiRoot, "dist/cjs/core/index.js"));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function digest(value) { return `sha256:${digestValue(canonical(value)).replace(/^sha256:/, "")}`; }
function seal(body) { return { ...body, digest: digest(body) }; }
function slotDefinition(slot) {
  return { id: slot.id, label: slot.label, value_type: "string", critical: slot.critical, acquisition: slot.acquisition, evidence_required: true, minimum_authority: "owner_asserted", freshness_required: "current" };
}

const corpusPath = path.join(projectRoot, "03-data/outcome-pilot-corpus-v2.json");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const conditions = [];

for (const testCase of corpus.cases) {
  const contractBody = {
    contract_version: "1.0.0",
    id: `outcome.pilot.${testCase.id.toLowerCase()}`,
    goal: testCase.task,
    scope: { purpose: testCase.contract_purpose || testCase.purpose, domains: testCase.contract_domains || testCase.domains, effect: "read_only" },
    outcome_kind: testCase.contour,
    required_slots: testCase.slots.filter((slot) => slot.critical).map(slotDefinition),
    optional_slots: testCase.slots.filter((slot) => !slot.critical).map(slotDefinition),
    completion_policy: { allow_partial: true, all_critical_required: true },
    interaction_policy: { max_questions: 1, ask_one_at_a_time: true },
    conflict_policy: { critical_conflict: "block", noncritical_conflict: "report" },
    template_authority: "owner_approved",
    execution_allowed: false,
    canonical_write_allowed: false
  };
  const contract = seal(contractBody);
  const candidateItems = testCase.slots.filter((slot) => slot.value !== null && slot.evidence_id).map((slot) => ({ id: `candidate.${testCase.id.toLowerCase()}.${slot.id}`, slot_id: slot.id, value: slot.value, evidence_refs: [slot.evidence_id], source_refs: [slot.source_ref], provider_ref: "pilot.frozen-input" }));
  const evidenceItems = testCase.slots.filter((slot) => slot.evidence_id).map((slot) => seal({
    id: slot.evidence_id,
    source_ref: slot.source_ref,
    contract_digest: contract.digest,
    slot_id: slot.id,
    value_digest: digest(slot.value),
    admission_receipt_digest: digest(["host-admission", contract.digest, slot.id, digest(slot.value)]),
    authority: "owner_asserted",
    freshness: "current",
    conflict_refs: slot.conflict_refs || [],
    authorized: true,
  }));
  const evidenceBody = { contract_version: "1.0.0", snapshot_digest: digest(testCase.slots.map((slot) => slot.evidence_text || null)), policy_digest: digest("outcome-pilot-policy-v2"), items: evidenceItems, partial: false, limitations: ["Controlled public-safe replay; no production effect."], canonical_write_allowed: false };
  const evidence = seal(evidenceBody);
  const candidateBody = { contract_version: "1.0.0", id: `candidates.${testCase.id.toLowerCase()}`, contract_digest: contract.digest, provider: { id: "pilot.frozen-input" }, input_digest: digest(testCase.task), output_digest: digest(candidateItems), candidates: candidateItems, context: { purpose: testCase.purpose, domains: testCase.domains, availability: "available", handoff_required: Boolean(testCase.handoff_required) }, accepted: false, execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false };
  const candidates = seal(candidateBody);
  const assessment = assessOutcome(contract, candidates, evidence);
  const delivery = planOutcomeDelivery(assessment, testCase.handoff_required ? "human.owner" : null);
  if (assessment.status !== testCase.expected.status) throw new Error(`${testCase.id}:expected_${testCase.expected.status}:actual_${assessment.status}`);

  const sourceExcerpts = testCase.slots.filter((slot) => slot.evidence_id).map((slot) => ({ evidence_id: slot.evidence_id, source_ref: slot.source_ref, text: slot.evidence_text }));
  const retrievalAnswer = {
    status: sourceExcerpts.length ? "ready" : "insufficient_evidence",
    claims: sourceExcerpts.map((item) => ({ text: item.text, evidence_refs: [item.evidence_id], source_refs: [item.source_ref] })),
    limitations: evidence.limitations,
    execution_allowed: false,
    canonical_write_allowed: false
  };
  const shared = { case_id: testCase.id, contour: testCase.contour, task: testCase.task, expected: testCase.expected, admitted_evidence_ids: evidenceItems.map((item) => item.id), source_excerpts: sourceExcerpts };
  conditions.push({ ...shared, condition: "application_only", context: { source_excerpts: sourceExcerpts } });
  conditions.push({ ...shared, condition: "retrieval_only", context: { retrieval_answer: retrievalAnswer } });
  conditions.push({ ...shared, condition: "outcome_completion", context: { outcome_contract: contract, outcome_assessment: assessment, delivery_plan: delivery } });
}

const body = { study_id: "mirai-outcome-controlled-pilot-v2", corpus_id: "mirai-outcome-pilot-v2", corpus_digest: digest(corpus), status: "frozen_before_model_execution", conditions, condition_count: conditions.length, canonical_write_allowed: false };
const output = seal(body);
fs.writeFileSync(path.join(projectRoot, "03-data/condition-packets-v2.json"), `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ valid: true, case_count: corpus.cases.length, condition_count: conditions.length, digest: output.digest }, null, 2)}\n`);
