const test = require("node:test");
const assert = require("node:assert/strict");
const { snapshot, oracle } = require("../fixtures/graph-organization.cjs");
const { projectAccessibleSnapshot, createGraphSnapshot } = require("../../dist/cjs/stdlib");
const k = require("../../dist/cjs/knowledge");
const { digestValue } = require("../../dist/cjs/core");
const policy = { id: "policy.topics", keys: ["topics"], max_groups: 20, max_group_size: 20, max_memberships: 40 };
function graph() { return projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) }); }

test("rule clusters match the prewritten oracle, overlap and do not duplicate shared sources", () => {
  const input = graph(); const result = k.proposeRuleClusters(input, policy);
  const groups = Object.fromEntries(result.groups.map(g => [`${g.scope}/${g.value}`, g.member_ids]));
  assert.deepEqual(groups, oracle.groups);
  assert.deepEqual(result.unassigned_ids, oracle.unassigned);
  assert.deepEqual(result.overlapping_ids, oracle.multiply_assigned);
  for (const group of result.groups) assert.equal(k.materializeClusterView(input, result, group.id).graph.sources.length, 1);
  assert.equal(result.canonical_write_allowed, false);
  const expected = Object.fromEntries(result.groups.map(g => [g.id, oracle.groups[`${g.scope}/${g.value}`]]));
  assert.equal(k.evaluateClusters(input, result, expected).exact_oracle_match, true);
  assert.equal(k.evaluateClusters(input, result).exact_oracle_match, null);
  assert.equal(k.evaluateClusters(input, result).correctness_proven, false);
});

test("group identity survives membership changes while proposal and revision digest change", () => {
  const input = graph(); const before = k.proposeRuleClusters(input, policy);
  const { digest, ...next } = structuredClone(input);
  next.objects.find(o => o.id === "unclassified").metadata.topics = ["safety"];
  const after = k.proposeRuleClusters(createGraphSnapshot(next), policy);
  const a = before.groups.find(g => g.scope === "client.a" && g.value === "safety");
  const b = after.groups.find(g => g.scope === "client.a" && g.value === "safety");
  assert.equal(a.id, b.id); assert.notEqual(a.revision_digest, b.revision_digest);
  assert.notEqual(before.digest, after.digest);
  assert.throws(() => k.materializeClusterView(createGraphSnapshot(next), before, a.id), /base_digest_mismatch/);
});

test("cluster proposal canonicalization is deterministic and resource limits fail closed", () => {
  const input = graph(); const expected = k.proposeRuleClusters(input, policy);
  for (let n = 0; n < 100; n++) assert.deepEqual(k.proposeRuleClusters(input, policy), expected);
  for (const limit of [{ max_groups: 1 }, { max_group_size: 1 }, { max_memberships: 1 }])
    assert.throws(() => k.proposeRuleClusters(input, { ...policy, ...limit }), /budget_exceeded/);
  assert.throws(() => k.proposeRuleClusters(input, { ...policy, grant: true }), /policy_invalid/);
});

test("bounded relation clustering remains in scope and does not activate an expired edge", () => {
  const result = k.proposeRuleClusters(graph(), { ...policy, neighborhood: {
    relation_types: ["depends_on"], now: "2026-01-01T00:00:00Z", max_depth: 5
  } });
  const a = result.groups.find(g => g.scope === "client.a" && g.value === "verification");
  assert.deepEqual(a.member_ids, oracle.traversal);
  const b = result.groups.find(g => g.scope === "client.b");
  assert.deepEqual(b.member_ids, ["verification.b"]);
});

test("provider responses are proposals; invented refs, cross-scope membership and authority fields fail", () => {
  const input = graph();
  const response = { groups: [{ scope: "client.a", key: "topics", value: "review", member_ids: ["requirements.a", "verification.a"] }] };
  const proposal = k.importProviderClusters(input, policy, "provider.recorded", response);
  k.assertClusterProposal(input, proposal);
  assert.equal(proposal.origin, "provider"); assert.equal(proposal.status, "proposed");
  for (const member of ["private.a", "invented", "verification.b"]) {
    assert.throws(() => k.importProviderClusters(input, policy, "provider.recorded", { groups: [{ ...response.groups[0], member_ids: [member] }] }), /unknown_or_wrong_scope/);
  }
  assert.throws(() => k.importProviderClusters(input, policy, "provider.recorded", { ...response, capabilities: ["all"] }), /shape_invalid/);
  const forged = structuredClone(proposal); forged.groups[0].evidence_refs.push("source.hidden");
  const { digest, ...body } = forged; forged.digest = digestValue(body);
  assert.throws(() => k.assertClusterProposal(input, forged), /evidence_mismatch/);
});

test("inference requires host authorization and replay needs no model call", async () => {
  let calls = 0;
  const input = graph();
  const provider = { id: "provider.mock", async propose() { calls++; return { groups: [{ scope: "client.a", key: "topics", value: "review", member_ids: ["requirements.a"] }] }; } };
  await assert.rejects(k.requestProviderClusters(input, policy, provider, { timeout_ms: 50, authorize: () => false }), /not_authorized/);
  assert.equal(calls, 0);
  const result = await k.requestProviderClusters(input, policy, provider, { timeout_ms: 50, authorize: () => true });
  const replay = k.importProviderClusters(input, policy, provider.id, result.recorded_output);
  assert.deepEqual(replay, result.proposal); assert.equal(calls, 1);
  const slow = { id: "provider.slow", propose(_input, { signal }) { return new Promise((resolve) => signal.addEventListener("abort", () => resolve({ groups: [] }))); } };
  await assert.rejects(k.requestProviderClusters(input, policy, slow, { timeout_ms: 5, authorize: () => true }), /timeout/);
});
