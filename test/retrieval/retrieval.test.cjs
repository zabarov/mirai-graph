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
  FederatedRetrievalCache,
  inferRetrievalIntent,
  inspectLocalRetrievalIndex,
  readRetrievalConfig,
  searchLocalRetrievalIndex,
  validateFederatedEnvelope
} = require("../../dist/cjs/retrieval");
const { createGraphSnapshot } = require("../../dist/cjs/stdlib");
const { createLocalEmbeddingProvider, prepareLocalEmbeddingModel, digestDirectory } = require("../../packages/embedding-local");

const fixture = path.resolve(__dirname, "../../examples/mirai-retrieval-minimal");

function prependRetrievalInput(source, input) {
  return source.replace(/(^inputs:\r?\n)/m, `$1${input.replaceAll("\n", os.EOL)}${os.EOL}`);
}

test("intent inference is Unicode-safe for Russian and English requests", () => {
  const cases = [
    ["актуальная политика выпуска", "change_or_freshness"],
    ["зависимости пакета", "relationship_trace"],
    ["технология миграции", "technology_lookup"],
    ["правила согласования", "policy_lookup"],
    ["доказательства тестирования", "evidence_lookup"],
    ["каноническое техническое задание", "exact_lookup"],
    ["latest release policy", "change_or_freshness"],
    ["package dependency path", "relationship_trace"]
  ];
  for (const [query, expected] of cases) assert.equal(inferRetrievalIntent(query).intent, expected, query);
});

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

test("query-focused snippets preserve separated evidence instead of truncating the later claim", async () => {
  const root = projectCopy();
  try {
    const unitsFile = path.join(root, "inputs/normalized-units.json");
    const value = JSON.parse(fs.readFileSync(unitsFile, "utf8"));
    value.units[0].content = `not raw project material ${"background ".repeat(110)} private skill implementation details`;
    value.units[0].content_digest = digestValue(value.units[0].content);
    fs.writeFileSync(unitsFile, JSON.stringify(value));
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    const result = await searchLocalRetrievalIndex(root, request(config, "May this publish raw project material or private implementation details?"));
    const snippet = result.evidence.hits.find((hit) => hit.document_id === value.units[0].id)?.snippet || "";
    assert.match(snippet, /not raw project material/);
    assert.match(snippet, /private skill implementation details/);
    assert.ok(snippet.length <= config.placement.max_snippet_chars);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("an explicit embedding provider enables vector retrieval and stays rebuildable", async () => {
  const root = projectCopy();
  const provider = {
    id: "deterministic-test-provider", model: "Xenova/multilingual-e5-small", dimensions: 384, revision: "test-revision", files_digest: `sha256:${"e".repeat(64)}`,
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
    fs.writeFileSync(configFile, prependRetrievalInput(configSource, "  - kind: graph_snapshot\n    path: inputs/graph.json"));
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
  assert.match(provider.revision, /^[a-f0-9]{40}$/);
  assert.equal(provider.model, "Xenova/multilingual-e5-small");
  await assert.rejects(() => provider.embed(["query: test"]), /embedding_expected_files_digest_required/);
  await assert.rejects(() => prepareLocalEmbeddingModel({ cache_dir: path.join(os.tmpdir(), "mirai-model-missing") }), /embedding_download_requires_explicit_allow_download/);
  await assert.rejects(() => prepareLocalEmbeddingModel({ cache_dir: path.join(os.tmpdir(), "mirai-model-missing"), allow_download: true }), /embedding_revision_required_for_download/);
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
  const indexDigest = `sha256:${"c".repeat(64)}`;
  const directory = [{ graph_id: "graph.release", domains: ["release"], intents: ["policy_lookup"], scopes: ["demo"], source_refs: ["source.demo"], authority: "owner_asserted", freshness: "current", endpoint_alias: "endpoint.release", policy_digest: policyDigest, index_digest: indexDigest, graph_digest: null, cache_ttl_ms: 1000 }];
  const cache = new FederatedRetrievalCache();
  let calls = 0;
  const output = await dispatchFederatedQuery(directory, envelope, {
    "endpoint.release": async (requestEnvelope, entry) => {
      calls += 1;
      const evidenceBody = { contract_version: "1.0.0", query_digest: digestValue(requestEnvelope), index_digest: indexDigest, graph_digest: null, policy_digest: entry.policy_digest, hits: [], source_refs: [], conflicts: [], limitations: [], partial: false, instructions_authorized: false, canonical_write_allowed: false };
      const evidence = { ...evidenceBody, digest: digestValue(evidenceBody) };
      const body = { contract_version: "1.0.0", query_id: requestEnvelope.id, responder_graph_id: entry.graph_id, query_digest: digestValue(requestEnvelope), index_digest: evidence.index_digest, graph_digest: null, policy_digest: entry.policy_digest, evidence_bundle: evidence, status: "complete", blockers: [], usage: { tokens_used: 10, cost_used: 0.01, duration_ms: 1 }, instructions_authorized: false, canonical_write_allowed: false };
      return { ...body, digest: digestValue(body) };
    }
  }, { cache });
  assert.equal(output.results.length, 1);
  assert.equal(output.partial, false);
  const cached = await dispatchFederatedQuery(directory, envelope, { "endpoint.release": async () => { throw new Error("cache_miss"); } }, { cache });
  assert.equal(cached.results.length, 1);
  assert.equal(calls, 1);
  assert.equal(cache.invalidateGraph("graph.release"), 1);
  assert.ok(validateFederatedEnvelope({ ...envelope, visited_graph_ids: ["graph.a", "graph.a"] }).includes("federated_route_cycle_detected"));
  assert.ok(validateFederatedEnvelope({ ...envelope, deadline: "2000-01-01T00:00:00Z" }).includes("federated_deadline_expired"));
  const timeoutEnvelope = { ...envelope, id: "fq.timeout", deadline: new Date(Date.now() + 25).toISOString() };
  const timedOut = await dispatchFederatedQuery(directory, timeoutEnvelope, { "endpoint.release": () => new Promise(() => undefined) });
  assert.equal(timedOut.partial, true);
  assert.ok(timedOut.blockers.some((item) => item.includes("federated_remote_timeout")));
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
  const hit = { document_id: "doc.expected", kind: "text", title: "Evidence", snippet: "Evidence", source_ref: "source.demo", scope: "demo", authority: "owner_asserted", freshness: "current", graph_object_refs: [], evidence_refs: ["source.demo"], program_refs: [], policy_refs: [], channels: ["lexical"], rank_score: 1, match_reasons: ["bm25_lexical_match"], instructions_authorized: false, canonical_write_allowed: false };
  const answerBody = { contract_version: "1.0.0", request_id: "q", intent: "exact_lookup", status: "answered", answer: "Evidence", claims: [{ text: "Evidence", evidence_refs: ["source.demo"], source_refs: ["source.demo"] }], relevant_relationships: [], program_candidates: [], policy_refs: [], conflicts: [], limitations: [], next_safe_action: "review_evidence_before_action", execution_allowed: false, content_is_untrusted_data: true, canonical_write_allowed: false, evidence_bundle_digest: `sha256:${"d".repeat(64)}` };
  const answer = { ...answerBody, digest: digestValue(answerBody) };
  const result = evaluateRetrieval("corpus.demo", "mirai_planner", [{ expected_document_ids: ["doc.expected"], expected_intent: "exact_lookup", predicted_intent: "exact_lookup", hits: [hit], answer, latency_ms: 5 }]);
  assert.equal(result.recall_at_k, 1);
  assert.equal(result.evidence_coverage, 1);
  assert.equal(result.unauthorized_hit_count, 0);
  assert.match(result.limitations[0], /Synthetic/);
});

test("declared snapshots, query graphs and confidential projections fail closed", async () => {
  const root = projectCopy();
  try {
    const configFile = path.join(root, "mirai/retrieval.yaml");
    fs.appendFileSync(configFile, "");
    const source = fs.readFileSync(configFile, "utf8");
    fs.writeFileSync(configFile, source.replace("path: inputs/normalized-units.json", `path: inputs/normalized-units.json\n    snapshot_digest: sha256:${"f".repeat(64)}`));
    await assert.rejects(() => buildLocalRetrievalIndex(root), /retrieval_input_snapshot_digest_mismatch/);
    fs.writeFileSync(configFile, source);
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    const otherGraph = createGraphSnapshot({ contract_version: "1.0.0", id: "graph.other", canonical_write_allowed: false, sources: [], objects: [], relations: [] });
    await assert.rejects(() => searchLocalRetrievalIndex(root, { ...request(config), graph: otherGraph }), /retrieval_graph_snapshot_mismatch/);

    const values = [{ id: "secret-record", title: "password=super-secret-value", scope: "retrieval-demo", token: "must-not-leak" }];
    fs.writeFileSync(path.join(root, "inputs/policies.json"), JSON.stringify(values));
    fs.writeFileSync(configFile, prependRetrievalInput(source, "  - kind: policies\n    path: inputs/policies.json").replace("source_refs: [source.demo]", "source_refs: [source.demo, inputs/policies.json]"));
    const configWithPolicy = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    const projected = fs.readFileSync(path.join(root, ".mirai/indexes/retrieval.demo/documents.json"), "utf8");
    assert.doesNotMatch(projected, /super-secret-value|must-not-leak/);
    assert.match(projected, /policy:secret-record/);
    assert.equal(configWithPolicy.access.principal_id, "principal.demo-reader");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("authorization is rejected before configured sources are parsed", async () => {
  const root = projectCopy();
  try {
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root);
    fs.writeFileSync(path.join(root, "inputs/normalized-units.json"), "not-json");
    const wrongAccess = { ...config.access, principal_id: "principal.unauthorized" };
    await assert.rejects(() => searchLocalRetrievalIndex(root, { ...request(config), access: wrongAccess }), /retrieval_access_projection_mismatch/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("federation narrows delegated access and rejects forged remote evidence", async () => {
  const policyDigest = `sha256:${"b".repeat(64)}`;
  const indexDigest = `sha256:${"c".repeat(64)}`;
  const envelope = { contract_version: "1.0.0", id: "fq.narrow", origin_graph_id: "graph.parent", requester: { principal_id: "principal.demo", purpose: "find_policy", scopes: ["demo", "admin"], source_refs: ["source.demo", "source.admin"], policy_digest: policyDigest }, query: "release policy", intent: "policy_lookup", target_domains: ["release"], visited_graph_ids: [], max_hops: 3, max_fan_out: 2, deadline: "2099-01-01T00:00:00Z", token_budget: 1000, cost_budget: 1, freshness_required: "current", canonical_write_allowed: false };
  const entry = { graph_id: "graph.release", domains: ["release"], intents: ["policy_lookup"], scopes: ["demo"], source_refs: ["source.demo"], authority: "owner_asserted", freshness: "current", endpoint_alias: "endpoint.release", policy_digest: policyDigest, index_digest: indexDigest, graph_digest: null };
  let seen;
  const output = await dispatchFederatedQuery([entry], envelope, { "endpoint.release": async (forwarded) => {
    seen = forwarded.requester;
    const evidenceBody = { contract_version: "1.0.0", query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, hits: [], source_refs: [], conflicts: [], limitations: [], partial: false, instructions_authorized: false, canonical_write_allowed: false };
    const evidence = { ...evidenceBody, digest: digestValue(evidenceBody) };
    const body = { contract_version: "1.0.0", query_id: envelope.id, responder_graph_id: entry.graph_id, query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, evidence_bundle: evidence, status: "complete", blockers: [], usage: { tokens_used: 10, cost_used: 0.01, duration_ms: 1 }, instructions_authorized: false, canonical_write_allowed: false };
    return { ...body, digest: digestValue(body) };
  }});
  assert.equal(output.results.length, 1);
  assert.deepEqual(seen.scopes, ["demo"]);
  assert.deepEqual(seen.source_refs, ["source.demo"]);

  const forged = await dispatchFederatedQuery([entry], { ...envelope, id: "fq.forged" }, { "endpoint.release": async (forwarded) => {
    const evidenceBody = { contract_version: "1.0.0", query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, hits: [], source_refs: [], conflicts: [], limitations: [], partial: false, instructions_authorized: false, canonical_write_allowed: false };
    const evidence = { ...evidenceBody, digest: `sha256:${"d".repeat(64)}` };
    const body = { contract_version: "1.0.0", query_id: "fq.forged", responder_graph_id: entry.graph_id, query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, evidence_bundle: evidence, status: "complete", blockers: [], usage: { tokens_used: 10, cost_used: 0.01, duration_ms: 1 }, instructions_authorized: false, canonical_write_allowed: false };
    return { ...body, digest: digestValue(body) };
  }});
  assert.equal(forged.results.length, 0);
  assert.ok(forged.blockers.some((value) => value.includes("federated_evidence_digest_mismatch")));
});

test("secret-bearing and reference-only records never enter snippets or embedding input", async () => {
  const root = projectCopy();
  const captured = [];
  const provider = {
    id: "deterministic-test-provider", model: "Xenova/multilingual-e5-small", dimensions: 384, revision: "test-revision", files_digest: `sha256:${"e".repeat(64)}`,
    async embed(texts) { captured.push(...texts); return texts.map(() => Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0)); }
  };
  try {
    const secret = `AKIA${"A".repeat(16)}`;
    fs.writeFileSync(path.join(root, "inputs/policies.json"), JSON.stringify([
      { id: "aws-secret", title: secret, scope: "retrieval-demo" },
      { id: "confidential-rule", title: "private merger plan", scope: "retrieval-demo", confidentiality: "confidential" }
    ]));
    const configFile = path.join(root, "mirai/retrieval.yaml");
    const source = fs.readFileSync(configFile, "utf8");
    fs.writeFileSync(configFile, source.replace("inputs:\n", "inputs:\n  - kind: policies\n    path: inputs/policies.json\n").replace("source_refs: [source.demo]", "source_refs: [source.demo, inputs/policies.json]"));
    await buildLocalRetrievalIndex(root, { embedding_provider: provider });
    const projected = fs.readFileSync(path.join(root, ".mirai/indexes/retrieval.demo/documents.json"), "utf8");
    assert.doesNotMatch(projected, new RegExp(secret));
    assert.doesNotMatch(projected, /private merger plan/);
    assert.doesNotMatch(captured.join("\n"), new RegExp(secret));
    assert.doesNotMatch(captured.join("\n"), /private merger plan/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("embedding cache digest uses unambiguous path and content framing", () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-digest-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-digest-b-"));
  try {
    fs.writeFileSync(path.join(first, "a"), "bc");
    fs.writeFileSync(path.join(second, "ab"), "c");
    assert.notEqual(digestDirectory(first), digestDirectory(second));
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});

test("local semantic retrieval fails closed when its deadline is exceeded", async () => {
  const root = projectCopy();
  const identity = { id: "deadline-provider", model: "Xenova/multilingual-e5-small", dimensions: 384, revision: "test-revision", files_digest: `sha256:${"e".repeat(64)}` };
  const fast = { ...identity, async embed(texts) { return texts.map(() => Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0)); } };
  const slow = { ...identity, async embed(texts) { await new Promise((resolve) => setTimeout(resolve, 40)); return fast.embed(texts); } };
  try {
    const configFile = path.join(root, "mirai/retrieval.yaml");
    fs.writeFileSync(configFile, fs.readFileSync(configFile, "utf8").replace("timeout_ms: 5000", "timeout_ms: 10"));
    const config = readRetrievalConfig(root);
    await buildLocalRetrievalIndex(root, { embedding_provider: fast });
    await assert.rejects(() => searchLocalRetrievalIndex(root, { ...request(config, "release policy"), intent: "semantic_discovery", channels: ["semantic"] }, { embedding_provider: slow }), /retrieval_timeout_exceeded/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("federated retrieval rejects out-of-scope hits and reported budget overruns", async () => {
  const policyDigest = `sha256:${"b".repeat(64)}`;
  const indexDigest = `sha256:${"c".repeat(64)}`;
  const envelope = { contract_version: "1.0.0", id: "fq.scope", origin_graph_id: "graph.parent", requester: { principal_id: "principal.demo", purpose: "find_policy", scopes: ["demo"], source_refs: ["source.demo"], policy_digest: policyDigest }, query: "release policy", intent: "policy_lookup", target_domains: ["release"], visited_graph_ids: [], max_hops: 3, max_fan_out: 1, deadline: "2099-01-01T00:00:00Z", token_budget: 100, cost_budget: 1, freshness_required: "current", canonical_write_allowed: false };
  const entry = { graph_id: "graph.release", domains: ["release"], intents: ["policy_lookup"], scopes: ["demo"], source_refs: ["source.demo"], authority: "owner_asserted", freshness: "current", endpoint_alias: "endpoint.release", policy_digest: policyDigest, index_digest: indexDigest, graph_digest: null };
  const make = (forwarded, hit, usage) => {
    const evidenceBody = { contract_version: "1.0.0", query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, hits: hit ? [hit] : [], source_refs: hit ? [hit.source_ref] : [], conflicts: [], limitations: [], partial: false, instructions_authorized: false, canonical_write_allowed: false };
    const evidence = { ...evidenceBody, digest: digestValue(evidenceBody) };
    const body = { contract_version: "1.0.0", query_id: envelope.id, responder_graph_id: entry.graph_id, query_digest: digestValue(forwarded), index_digest: indexDigest, graph_digest: null, policy_digest: policyDigest, evidence_bundle: evidence, status: "complete", blockers: [], usage, instructions_authorized: false, canonical_write_allowed: false };
    return { ...body, digest: digestValue(body) };
  };
  const forbiddenHit = { document_id: "forbidden", kind: "policy", title: "Forbidden", snippet: "", source_ref: "source.forbidden", scope: "admin", authority: "owner_asserted", freshness: "current", graph_object_refs: [], evidence_refs: [], program_refs: [], policy_refs: [], channels: ["lexical"], rank_score: 1, match_reasons: [], instructions_authorized: false, canonical_write_allowed: false };
  const scoped = await dispatchFederatedQuery([entry], envelope, { "endpoint.release": async (forwarded) => make(forwarded, forbiddenHit, { tokens_used: 1, cost_used: 0, duration_ms: 1 }) });
  assert.equal(scoped.results.length, 0);
  assert.ok(scoped.blockers.some((value) => value.includes("federated_result_source_scope_violation") || value.includes("federated_result_hit_scope_violation")));
  const over = await dispatchFederatedQuery([entry], envelope, { "endpoint.release": async (forwarded) => make(forwarded, null, { tokens_used: 101, cost_used: 0, duration_ms: 1 }) });
  assert.equal(over.results.length, 0);
  assert.ok(over.blockers.some((value) => value.includes("federated_result_budget_exceeded")));
});
