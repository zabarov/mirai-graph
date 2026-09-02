const assert = require("node:assert/strict");
const test = require("node:test");
const { digestValue } = require("../../dist/cjs/core");
const { organizeKnowledge } = require("../../dist/cjs/knowledge");

function unit(id, content, scope = "demo") {
  return { contract_version: "1.0.0", id, source_ref: `source:${id}`, source_fingerprint: digestValue(id), kind: "record", media_type: "application/json", ordinal: 1, content, content_digest: digestValue(content), authority: "owner_asserted", scope, confidentiality: "internal", instructions_authorized: false };
}

test("knowledge organization preserves provenance and blocks conflicting assertions", () => {
  const proposal = organizeKnowledge({ units: [unit("one", { title: "Policy", status: "draft", owner_ref: "team-a" }), unit("copy", { title: "Policy", status: "draft", owner_ref: "team-a" }), unit("conflict", { title: "Policy", status: "active", owner_ref: "team-a" })] });
  assert.equal(proposal.exact_duplicate_groups.length > 0, true);
  assert.equal(proposal.conflicts.length > 0, true);
  assert.equal(proposal.quality.readiness, "blocked");
  assert.equal(proposal.relation_facts.some((fact) => fact.type === "owner_ref"), true);
  assert.equal(proposal.assertions.every((assertion) => assertion.provenance.length > 0), true);
  assert.equal(proposal.canonical_write_allowed, false);
});

test("ambiguous identities require owner review and are never auto-merged", () => {
  const proposal = organizeKnowledge({ units: [unit("candidate", { title: "Policy", value: 1 })], known_identities: ["org-a:policy", "org-b:policy"] });
  assert.equal(proposal.identity_resolutions[0].resolution, "ambiguous");
  assert.equal(proposal.identity_resolutions[0].owner_review_required, true);
  assert.equal(proposal.quality.readiness, "blocked");
});

test("lossy punctuation and unapproved aliases cannot silently merge identities", () => {
  const punctuation = organizeKnowledge({ units: [unit("dash", { title: "Team-A", value: 1 }), unit("space", { title: "Team A", value: 1 })] });
  assert.equal(new Set(punctuation.assertions.map((item) => item.identity_key)).size, 2);

  const alias = { alias: "Legacy Name", canonical_identity: "demo:canonical", scope: "demo", reviewed: true, approval_ref: "" };
  const unapproved = organizeKnowledge({ units: [unit("alias", { title: "Legacy Name", value: 1 })], aliases: [alias] });
  assert.equal(unapproved.identity_resolutions[0].resolution, "new_identity");
});

test("graph-growth limits return a proposal-only partition route instead of expanding unboundedly", () => {
  const inputUnit = unit("large", { a: 1, b: 2, c: 3 });
  const result = organizeKnowledge({ units: [inputUnit], budgets: { max_assertions: 2 } });
  assert.equal(result.quality.readiness, "blocked");
  assert.equal(result.next_safe_action, "partition_source");
  assert.equal(result.growth_control?.dimension, "assertions");
  assert.equal(result.growth_control?.automatic_pruning_allowed, false);
  assert.equal(result.assertions.length, 0);
  assert.equal(result.canonical_write_allowed, false);
});
