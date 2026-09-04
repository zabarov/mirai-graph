const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const { digestValue } = require("../../dist/cjs/core");
const {
  buildLocalRetrievalIndex,
  dispatchFederatedQuery,
  evaluateRetrieval,
  inspectLocalRetrievalIndex,
  readRetrievalConfig,
  searchLocalRetrievalIndex,
  validateFederatedEnvelope
} = require("../../dist/cjs/retrieval");
const { createGraphSnapshot } = require("../../dist/cjs/stdlib");
const { createLocalEmbeddingProvider, prepareLocalEmbeddingModel } = require("../../packages/embedding-local");

const fixture = path.resolve(__dirname, "../../examples/mirai-retrieval-minimal");

function projectCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-retrieval-"));
  fs.cpSync(fixture, root, { recursive: true });
  return root;
}

function request(config, query = "release policy") {
  return { contract_version: "1.0.0", id: "query.demo", query, access: config.access, canonical_write_allowed: false };
}

test("local index is deterministic, disposable and visibly degraded without embeddings", async () => {
  const root = projectCopy();
  try {
    const first = await buildLocalRetrievalIndex(root, { built_at: "2026-01-01T00:00:00Z" });
    const second = await buildLocalRetrievalIndex(root, { built_at: "2027-01-01T00:00:00Z" });
    assert.equal(first.digest, second.digest);
    assert.equal(first.documents_digest, second.documents_digest);
    assert.equal(first.semantic_status, "provider_unavailable");
    assert.equal(inspectLocalRetrievalIndex(root).status, "ready");
    const serialized = fs.readFileSync(path.join(root, ".mirai/indexes/retrieval.demo/documents.json"), "utf8");
    assert.doesNotMatch(serialized, /must-not-be-indexed/);
    assert.match(serialized, /unit\.internal-reference/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("answers are evidence-bound and do not pretend lexical search is semantic", async () => {
  const root = projectCopy();
  try {
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    const result = await searchLocalRetrievalIndex(root, request(config));
    assert.equal(result.answer.status, "partial");
    assert.equal(result.answer.execution_allowed, false);
    assert.equal(result.answer.canonical_write_allowed, false);
    assert.ok(result.answer.claims.every((claim) => claim.evidence_refs.length > 0));
    assert.ok(result.plan.diagnostics.includes("semantic_provider_unavailable"));
    assert.ok(!result.plan.channels.includes("semantic"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("an explicit embedding provider enables vector retrieval and stays rebuildable", async () => {
  const root = projectCopy();
  const provider = {
    id: "deterministic-test-provider", model: "Xenova/multilingual-e5-small", dimensions: 384,
    async embed(texts) { return texts.map((text) => Array.from({ length: 384 }, (_, index) => index === 0 ? (/release/i.test(text) ? 1 : 0) : index === 1 ? 1 : 0)); }
  };
  try {
    const descriptor = await buildLocalRetrievalIndex(root, { embedding_provider: provider });
    assert.equal(descriptor.semantic_status, "ready");
    assert.equal(inspectLocalRetrievalIndex(root).status, "ready");
    const semanticRequest = { ...request(readRetrievalConfig(root), "release requirements"), intent: "semantic_discovery" };
    const result = await searchLocalRetrievalIndex(root, semanticRequest, { embedding_provider: provider });
    assert.ok(result.plan.channels.includes("semantic"));
    assert.ok(result.evidence.hits.some((hit) => hit.channels.includes("semantic")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("source changes mark the projection stale and access cannot expand at query time", async () => {
  const root = projectCopy();
  try {
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    await assert.rejects(() => searchLocalRetrievalIndex(root, request({ ...config, access: { ...config.access, scopes: [...config.access.scopes, "other"] } })), /retrieval_access_projection_mismatch/);
    const units = path.join(root, "inputs/normalized-units.json");
    fs.appendFileSync(units, "\n");
    assert.equal(inspectLocalRetrievalIndex(root).status, "ready", "format-only changes do not affect semantic JSON snapshot");
    const value = JSON.parse(fs.readFileSync(units, "utf8"));
    value.units[0].content = `${value.units[0].content} Current evidence is mandatory.`;
    fs.writeFileSync(units, JSON.stringify(value));
    assert.equal(inspectLocalRetrievalIndex(root).status, "stale");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("storage tampering invalidates the disposable index", async () => {
  const root = projectCopy();
  try {
    await buildLocalRetrievalIndex(root);
    const storage = path.join(root, ".mirai/indexes/retrieval.demo/orama.json");
    const value = JSON.parse(fs.readFileSync(storage, "utf8"));
    value.__tampered = true;
    fs.writeFileSync(storage, JSON.stringify(value));
    assert.equal(inspectLocalRetrievalIndex(root).status, "invalid");
    assert.ok(inspectLocalRetrievalIndex(root).diagnostics.includes("retrieval_index_storage_digest_mismatch"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("relationship retrieval expands a bounded graph path", async () => {
  const root = projectCopy();
  try {
    const graph = createGraphSnapshot({
      contract_version: "1.0.0", id: "graph.retrieval-demo", canonical_write_allowed: false,
      sources: [{ id: "source.demo", owner_ref: "owner.demo", digest: digestValue("source.demo"), confidentiality: "public" }],
      objects: [
        { id: "feature.release", kind: "feature", scope: "retrieval-demo", metadata: { title: "Release" }, source_refs: ["source.demo"] },
        { id: "policy.release", kind: "policy", scope: "retrieval-demo", metadata: { title: "Release policy" }, source_refs: ["source.demo"] },
        { id: "evidence.release", kind: "evidence", scope: "retrieval-demo", metadata: { title: "Release evidence" }, source_refs: ["source.demo"] }
      ],
      relations: [
        { contract_version: "1.0.0", id: "relation.release-policy", type: "governed_by", participants: [{ ref: "feature.release", role: "subject" }, { ref: "policy.release", role: "governor" }], priority: 100, authority: "owner_asserted", confidence: 1, provenance: [{ source_ref: "source.demo" }], scope: "retrieval-demo" },
        { contract_version: "1.0.0", id: "relation.policy-evidence", type: "requires", participants: [{ ref: "policy.release", role: "subject" }, { ref: "evidence.release", role: "requirement" }], priority: 100, authority: "owner_asserted", confidence: 1, provenance: [{ source_ref: "source.demo" }], scope: "retrieval-demo" }
      ]
    });
    fs.writeFileSync(path.join(root, "inputs/graph.json"), `${JSON.stringify(graph)}\n`);
    const configFile = path.join(root, "mirai/retrieval.yaml");
    const configSource = fs.readFileSync(configFile, "utf8");
    fs.writeFileSync(configFile, configSource.replace("inputs:\n", "inputs:\n  - kind: graph_snapshot\n    path: inputs/graph.json\n"));
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    const graphRequest = { ...request(config, "feature.release"), intent: "relationship_trace", channels: ["exact", "graph"], graph };
    const result = await searchLocalRetrievalIndex(root, graphRequest);
    assert.ok(result.plan.channels.includes("graph"));
    assert.ok(result.evidence.hits.some((hit) => hit.graph_path && hit.graph_path.length >= 2));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("local embeddings never download implicitly", async () => {
  const provider = createLocalEmbeddingProvider({ cache_dir: path.join(os.tmpdir(), "mirai-model-missing"), allow_download: false });
  assert.equal(provider.model, "Xenova/multilingual-e5-small");
  await assert.rejects(() => prepareLocalEmbeddingModel({ cache_dir: path.join(os.tmpdir(), "mirai-model-missing") }), /embedding_download_requires_explicit_allow_download/);
});

test("federated retrieval is bounded and validates digest bindings", async () => {
  const policyDigest = `sha256:${"b".repeat(64)}`;
  const envelope = {
    contract_version: "1.0.0", id: "fq.demo", origin_graph_id: "graph.parent",
    requester: { principal_id: "principal.demo", purpose: "find_policy", scopes: ["demo"], source_refs: ["source.demo"], policy_digest: policyDigest },
    query: "release policy", intent: "policy_lookup", target_domains: ["release"], visited_graph_ids: [], max_hops: 3, max_fan_out: 2,
    deadline: "2099-01-01T00:00:00Z", token_budget: 1000, cost_budget: 1, freshness_required: "current", canonical_write_allowed: false
  };
  assert.deepEqual(validateFederatedEnvelope(envelope), []);
  const directory = [{ graph_id: "graph.release", domains: ["release"], intents: ["policy_lookup"], scopes: ["demo"], authority: "owner_asserted", freshness: "current", endpoint_alias: "endpoint.release", policy_digest: policyDigest }];
  const output = await dispatchFederatedQuery(directory, envelope, {
    "endpoint.release": async (requestEnvelope, entry) => {
      const evidenceBody = { contract_version: "1.0.0", query_digest: digestValue(requestEnvelope), index_digest: `sha256:${"c".repeat(64)}`, graph_digest: null, policy_digest: entry.policy_digest, hits: [], source_refs: [], conflicts: [], limitations: [], partial: false, instructions_authorized: false, canonical_write_allowed: false };
      const evidence = { ...evidenceBody, digest: digestValue(evidenceBody) };
      const body = { contract_version: "1.0.0", query_id: requestEnvelope.id, responder_graph_id: entry.graph_id, query_digest: digestValue(requestEnvelope), index_digest: evidence.index_digest, graph_digest: null, policy_digest: entry.policy_digest, evidence_bundle: evidence, status: "complete", blockers: [], instructions_authorized: false, canonical_write_allowed: false };
      return { ...body, digest: digestValue(body) };
    }
  });
  assert.equal(output.results.length, 1);
  assert.equal(output.partial, false);
  assert.ok(validateFederatedEnvelope({ ...envelope, visited_graph_ids: ["graph.a", "graph.a"] }).includes("federated_route_cycle_detected"));
  assert.ok(validateFederatedEnvelope({ ...envelope, deadline: "2000-01-01T00:00:00Z" }).includes("federated_deadline_expired"));
});

test("retrieval schemas compile", () => {
  for (const name of ["retrieval-project-config.schema.json", "retrieval-index-descriptor.schema.json", "retrieval-request.schema.json", "retrieval-plan.schema.json", "retrieval-evidence-bundle.schema.json", "retrieval-answer.schema.json", "retrieval-evaluation.schema.json", "federated-query-envelope.schema.json", "federated-query-result.schema.json"]) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", name), "utf8"));
    assert.doesNotThrow(() => ajv.compile(schema), name);
  }
});

test("retrieval evaluation reports ranking and evidence metrics without production claims", () => {
  const hit = { document_id: "doc.expected", kind: "text", title: "Expected", snippet: "Evidence", source_ref: "source.demo", scope: "demo", authority: "owner_asserted", freshness: "current", graph_object_refs: [], evidence_refs: ["source.demo"], program_refs: [], policy_refs: [], channels: ["lexical"], rank_score: 1, match_reasons: ["bm25_lexical_match"] };
  const answerBody = { contract_version: "1.0.0", request_id: "q", intent: "exact_lookup", status: "answered", answer: "Evidence", claims: [{ text: "Evidence", evidence_refs: ["source.demo"], source_refs: ["source.demo"] }], relevant_relationships: [], program_candidates: [], policy_refs: [], conflicts: [], limitations: [], next_safe_action: "review_evidence_before_action", execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false, evidence_bundle_digest: `sha256:${"d".repeat(64)}` };
  const answer = { ...answerBody, digest: digestValue(answerBody) };
  const result = evaluateRetrieval("corpus.demo", "mirai_planner", [{ expected_document_ids: ["doc.expected"], expected_intent: "exact_lookup", predicted_intent: "exact_lookup", hits: [hit], answer, latency_ms: 5 }]);
  assert.equal(result.recall_at_k, 1);
  assert.equal(result.evidence_coverage, 1);
  assert.equal(result.unauthorized_hit_count, 0);
  assert.match(result.limitations[0], /Synthetic/);
});
