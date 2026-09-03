const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const g = require("../../dist/cjs/stdlib");
const { fixtureInput, snapshot, relation, oracle } = require("../fixtures/graph-organization.cjs");

function accessible() {
  return g.projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
}
const traversal = { seeds: ["verification.a"], relation_types: ["depends_on"], direction: "outgoing",
  from_role: "consumer", to_role: "dependency", scope: "client.a", now: "2026-01-01T00:00:00Z",
  max_depth: 4, max_objects: 10, max_relations: 10 };

test("snapshot canonicalization and graph operations are deterministic across 100 input permutations", () => {
  const baseline = snapshot();
  for (let i = 0; i < 100; i++) {
    const input = fixtureInput();
    if (i % 2) input.objects.reverse();
    if (i % 3) input.relations.reverse();
    input.objects.forEach(o => { if (Array.isArray(o.metadata.topics) && i % 4) o.metadata.topics.reverse(); });
    input.relations.forEach(r => { if (i % 5) r.participants.reverse(); });
    assert.deepEqual(g.createGraphSnapshot(input), baseline);
  }
});

test("host projection removes private objects, sources and relations without hidden counts", () => {
  const graph = accessible();
  assert.deepEqual(graph.objects.map(o => o.id), oracle.accessible);
  assert.equal(JSON.stringify(graph).includes("private"), false);
  assert.equal("base_digest" in graph, false);
  assert.equal(graph.sources.length, 1);
  const denied = g.projectAccessibleSnapshot(snapshot(), { object_ids: new Set(["private.a"]), source_ids: new Set() });
  assert.equal(denied.objects.length, 0);
});

test("exact queries return shared references in several contexts, never raw content", () => {
  const graph = accessible();
  assert.deepEqual(g.queryGraph(graph, { scopes: ["client.a"] }).object_ids, oracle.scope_a);
  const view = g.queryGraph(graph, { scopes: ["client.a"], metadata: { topics: "safety" } });
  assert.deepEqual(view.object_ids, ["requirements.a", "safety.a"]);
  assert.equal(view.graph.sources.length, 1);
  assert.equal(view.canonical_write_allowed, false);
  assert.throws(() => g.queryGraph(graph, { ids: ["unknown"] }), /unknown_query_object/);
  assert.throws(() => g.queryGraph(graph, { max_objects: 1 }), /budget_exceeded/);
  assert.throws(() => g.queryGraph(graph, { expression: "eval()" }), /unknown_query_field/);
});

test("traversal preserves contextual direction, excludes expired edges and fails on truncation", () => {
  const graph = accessible();
  const view = g.traverseGraph(graph, traversal);
  assert.deepEqual(view.object_ids, oracle.traversal);
  assert.deepEqual(view.graph.relations.map(r => r.id), ["edge.safety", "edge.verify"]);
  assert.equal(view.base_digest, graph.digest);
  assert.throws(() => g.traverseGraph(graph, { ...traversal, max_depth: 1 }), /depth_budget/);
  assert.throws(() => g.traverseGraph(graph, { ...traversal, max_objects: 1 }), /object_budget/);
  assert.throws(() => g.traverseGraph(graph, { ...traversal, max_relations: 1 }), /relation_budget/);
  assert.throws(() => g.traverseGraph(graph, { ...traversal, max_visits: 1 }), /work_budget/);
  const inverse = g.traverseGraph(graph, { ...traversal, seeds: ["safety.a"], direction: "incoming" });
  assert.deepEqual(inverse.object_ids, oracle.traversal);
});

test("reified relations retain all participants and qualifiers or are omitted as a whole", () => {
  const input = fixtureInput();
  input.relations = [relation("many", "requirements.a", "verification.a", {
    participants: [{ ref: "requirements.a", role: "subject" }, { ref: "verification.a", role: "reviewer" }, { ref: "private.a", role: "restricted" }],
    qualifiers: { risk: "low" }
  })];
  const graph = g.createGraphSnapshot(input);
  assert.equal(g.projectGraph(graph, ["requirements.a", "verification.a"]).graph.relations.length, 0);
  assert.deepEqual(g.projectGraph(graph, ["requirements.a", "verification.a", "private.a"]).graph.relations, graph.relations);
});

test("invalid shapes, stale digests, private paths, secret signatures and prototype input fail closed", () => {
  const input = fixtureInput();
  input.objects.push(input.objects[0]);
  assert.throws(() => g.createGraphSnapshot(input), /duplicate_object/);
  const stale = snapshot(); stale.objects[0].metadata.client = "changed";
  assert.throws(() => g.assertSnapshot(stale), /digest_mismatch/);
  for (const value of [NaN, Infinity, undefined, "/Users/example/private", "ghp_1234567890abcdefghij"]) {
    const broken = fixtureInput(); broken.objects[0].metadata.bad = value;
    assert.throws(() => g.createGraphSnapshot(broken));
  }
  for (const key of ["ghp_1234567890abcdefghij", "/Users/example/private"]) {
    const broken = fixtureInput(); broken.objects[0].metadata = { nested: { [key]: "redacted" } };
    assert.throws(() => g.createGraphSnapshot(broken), /sensitive_content_rejected/);
  }
  assert.doesNotThrow(() => g.requireJson({ nested: { access_token_ref: "access-center-alias" } }));
  const proto = fixtureInput(); proto.objects[0].metadata = JSON.parse('{"__proto__":"bad"}');
  assert.throws(() => g.createGraphSnapshot(proto), /unsafe_json_property/);
  const brokenTime = fixtureInput(); brokenTime.relations[0].valid_from = "not-a-date";
  assert.throws(() => g.createGraphSnapshot(brokenTime), /shape_invalid/);
  const missingSource = fixtureInput(); missingSource.relations[0].provenance[0].source_ref = "missing";
  assert.throws(() => g.createGraphSnapshot(missingSource), /relation_source_missing/);
});

test("patches and diffs are proposed values, preserve original state and never write", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-graph-readonly-"));
  try {
    const graph = accessible(); const original = structuredClone(graph);
    const changed = structuredClone(graph.objects.find(o => o.id === "requirements.a")); changed.metadata.status = "review_requested";
    const proposal = g.proposeGraphPatch(graph, { upsert_objects: [changed], deprecate_objects: [], upsert_relations: [], deprecate_relations: [] });
    assert.equal(proposal.status, "proposed");
    assert.equal(proposal.canonical_write_allowed, false);
    assert.deepEqual(graph, original);
    assert.deepEqual(g.diffGraphs(graph, proposal.preview).objects.changed, ["requirements.a"]);
    assert.deepEqual(fs.readdirSync(dir), []);
    assert.throws(() => g.proposeGraphPatch(graph, { ...proposal.changes, deprecate_objects: ["requirements.a"] }), /conflicting_patch_target/);
    assert.throws(() => g.proposeGraphPatch(graph, { ...proposal.changes, deprecate_objects: ["safety.a"] }), /relation_participant_missing/);
    const protectedObject = { ...changed, kind: "capability" };
    assert.throws(() => g.proposeGraphPatch(graph, { ...proposal.changes, upsert_objects: [protectedObject] }), /protected_object/);
    const authority = relation("authority", "requirements.a", "safety.a", { authority: "proposal", type: "governed_by" });
    assert.throws(() => g.proposeGraphPatch(graph, { ...proposal.changes, upsert_relations: [authority] }), /authority_relation/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
