#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { digestValue } = require("../../dist/cjs/core");
const { buildLocalRetrievalIndex, evaluateRetrieval, readRetrievalConfig, searchLocalRetrievalIndex } = require("../../dist/cjs/retrieval");
const { createLocalEmbeddingProvider } = require("../../packages/embedding-local");

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const cache = value("--model-cache");
if (!cache) throw new Error("model_cache_required");
const receipt = JSON.parse(fs.readFileSync(path.join(cache, "mirai-model-receipt.json"), "utf8"));
const baseProvider = createLocalEmbeddingProvider({ cache_dir: cache, revision: receipt.revision, expected_files_digest: receipt.files_digest, allow_download: false });
const usage = { calls: 0, input_tokens: 0 };
const provider = { ...baseProvider, async embed(texts) { usage.calls += 1; usage.input_tokens += texts.reduce((sum, text) => sum + Math.ceil(Buffer.byteLength(text, "utf8") / 4), 0); return baseProvider.embed(texts); } };
const root = __dirname;
const project = path.join(root, "project");
const corpus = JSON.parse(fs.readFileSync(path.join(root, "corpus.json"), "utf8"));
const graph = JSON.parse(fs.readFileSync(path.join(project, "inputs/graph.json"), "utf8"));
const config = readRetrievalConfig(project);
const systems = {
  lexical: ["lexical"],
  semantic: ["semantic"],
  graph: ["graph"],
  hybrid: ["lexical", "semantic"],
  mirai_planner: null
};

function claimFaithfulness(answer, hits) {
  if (!answer.claims.length) return ["clarification_required", "insufficient_evidence"].includes(answer.status) ? 1 : 0;
  return answer.claims.filter((claim) => hits.some((hit) => claim.source_refs.includes(hit.source_ref) && claim.evidence_refs.some((ref) => hit.evidence_refs.includes(ref)) && claim.text.includes(hit.title))).length / answer.claims.length;
}

function compactEvaluationCase(value) {
  return {
    ...value,
    hits: value.hits.map((hit) => ({ document_id: hit.document_id, freshness: hit.freshness, ...(hit.graph_path ? { graph_path: hit.graph_path } : {}) })),
    answer: {
      status: value.answer.status,
      claims: value.answer.claims.map((claim) => ({ evidence_refs: claim.evidence_refs, source_refs: claim.source_refs })),
      conflicts: value.answer.conflicts,
      execution_allowed: value.answer.execution_allowed,
      content_is_untrusted_data: value.answer.content_is_untrusted_data
    }
  };
}

async function main() {
  const implementationRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(root, "../.."), encoding: "utf8" }).trim();
  try { execFileSync("git", ["diff", "--quiet", "--", "src", "packages", "schemas", "test", "benchmarks/mirai-2.4-retrieval/run-evaluation.js", "benchmarks/mirai-2.4-retrieval/generate-corpus.js"], { cwd: path.resolve(root, "../..") }); }
  catch { throw new Error("retrieval_evaluation_implementation_tree_dirty"); }
  const descriptor = await buildLocalRetrievalIndex(project, { embedding_provider: provider, built_at: "2026-09-04T00:00:00.000Z" });
  usage.calls = 0;
  usage.input_tokens = 0;
  const bySystem = {};
  const raw = [];
  for (const [system, channels] of Object.entries(systems)) {
    const cases = [];
    for (const item of corpus.queries) {
      const request = { contract_version: "1.0.0", id: `${item.id}.${system}`, query: item.query, access: config.access, freshness_required: item.freshness_required, ...(channels ? { channels } : {}), graph, canonical_write_allowed: false };
      const beforeCalls = usage.calls;
      const beforeTokens = usage.input_tokens;
      const start = performance.now();
      const result = await searchLocalRetrievalIndex(project, request, { embedding_provider: provider });
      const latency = performance.now() - start;
      const evaluationCase = { expected_document_ids: item.expected_document_ids, relevance: item.relevance, expected_intent: item.expected_intent, predicted_intent: result.plan.intent, hits: result.evidence.hits, answer: result.answer, latency_ms: latency, claim_faithfulness: claimFaithfulness(result.answer, result.evidence.hits), conflict_expected: item.conflict_expected, stale_expected: item.stale_expected, ...(item.expected_graph_path ? { expected_graph_path: item.expected_graph_path } : {}), unauthorized_document_ids: item.unauthorized_document_ids, model_calls: usage.calls - beforeCalls, input_tokens: usage.input_tokens - beforeTokens, cost_usd: 0 };
      cases.push(evaluationCase);
      raw.push({ query_id: item.id, domain: item.domain, language: item.language, variant: item.variant, system, evaluation_case: compactEvaluationCase(evaluationCase), result_digest: result.answer.digest });
    }
    bySystem[system] = { aggregate: evaluateRetrieval(corpus.id, system, cases, 10), domains: {} };
    for (const domain of corpus.domains) {
      const domainCases = cases.filter((_item, index) => corpus.queries[index].domain === domain);
      bySystem[system].domains[domain] = evaluateRetrieval(`${corpus.id}.${domain}`, system, domainCases, 10);
    }
  }
  const safety = {
    unauthorized_hits: raw.flatMap((item) => item.hit_ids).filter((id) => id === "unit.restricted-control").length,
    unsupported_claims: Object.values(bySystem).some((result) => result.aggregate.claim_faithfulness < 1) ? "review_required" : "none_detected",
    semantic_fallback: descriptor.semantic_status === "ready" ? "not_applicable" : "blocked",
    canonical_write_allowed: false
  };
  const manifest = { contract_version: "1.0.0", corpus_digest: corpus.digest, implementation_revision: implementationRevision, node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model || "unknown", model: receipt.model, model_revision: receipt.revision, model_files_digest: receipt.files_digest, index_digest: descriptor.digest, systems: Object.keys(systems), query_count: corpus.query_count, generated_at: new Date().toISOString(), limitations: ["Public-safe controlled corpus; not a population-level scientific claim.", "Relevance judgments are authored with the frozen synthetic corpus and require external blinded review for confirmatory claims.", "Input tokens are deterministic UTF-8 byte/4 estimates for the local embedding provider; local model monetary cost is zero.", "Channel baselines use fixed channels but share the same inferred-intent mechanism; they are not oracle-assisted intent baselines."] };
  const reportBody = { contract_version: "1.0.0", corpus_id: corpus.id, manifest, systems: bySystem, safety, raw_results_digest: digestValue(raw), release_gate_status: safety.unauthorized_hits === 0 && safety.unsupported_claims === "none_detected" ? "passed_with_limitations" : "blocked" };
  const output = path.join(root, "results");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "raw-results.json"), `${JSON.stringify(raw, null, 2)}\n`);
  fs.writeFileSync(path.join(output, "evaluation-report.json"), `${JSON.stringify({ ...reportBody, digest: digestValue(reportBody) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: reportBody.release_gate_status, queries: raw.length, report_digest: digestValue(reportBody), results: path.relative(process.cwd(), output) }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
