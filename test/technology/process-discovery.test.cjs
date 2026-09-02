const assert = require("node:assert/strict");
const test = require("node:test");
const { digestValue } = require("../../dist/cjs/core");
const { discoverProcessCandidates, observationsFromUnits, processCandidateToTechnologyDraft } = require("../../dist/cjs/technology");

function unit(authority) {
  const content = "1. Inspect input.\n2. Validate result.\n3. Request approval.";
  return { contract_version: "1.0.0", id: `unit.${authority}`, source_ref: `source.${authority}`, source_fingerprint: digestValue(authority), kind: "text", media_type: "text/plain", ordinal: 1, content, content_digest: digestValue(content), authority, scope: "demo", confidentiality: "internal", instructions_authorized: false };
}

test("intended technology and observed practice remain separate", () => {
  const intended = observationsFromUnits([unit("owner_asserted")], { mode: "intended", process_hint: "review" });
  const observed = observationsFromUnits([unit("supporting")], { mode: "observed", process_hint: "review" });
  const candidates = discoverProcessCandidates([...intended, ...observed]);
  const intendedCandidate = candidates.find((item) => item.mode === "intended");
  const observedCandidate = candidates.find((item) => item.mode === "observed");
  assert.equal(intendedCandidate.technology_draft_allowed, true);
  assert.equal(observedCandidate.technology_draft_allowed, false);
  assert.equal(observedCandidate.diagnostics.some((item) => item.code === "observed_practice_not_normative"), true);
  const draft = processCandidateToTechnologyDraft(intendedCandidate);
  assert.equal(draft.canonical_write_allowed, false);
  assert.equal(draft.diagnostics.some((item) => item.code === "operation_bindings_require_qualification"), true);
});
