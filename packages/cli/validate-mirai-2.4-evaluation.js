#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { digestValue } = require("../../dist/cjs/core");
const { evaluateRetrieval } = require("../../dist/cjs/retrieval");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const root = path.resolve(__dirname, "../..");
const benchmark = path.join(root, "benchmarks/mirai-2.4-retrieval");
const corpus = JSON.parse(fs.readFileSync(path.join(benchmark, "corpus.json"), "utf8"));
const raw = JSON.parse(fs.readFileSync(path.join(benchmark, "results/raw-results.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(benchmark, "results/evaluation-report.json"), "utf8"));
const body = Object.fromEntries(Object.entries(report).filter(([key]) => key !== "digest"));

assert.equal(digestValue(body), report.digest, "report_digest");
assert.equal(digestValue(raw), report.raw_results_digest, "raw_results_digest");
assert.equal(corpus.digest, report.manifest.corpus_digest, "corpus_digest");
assert.equal(corpus.query_count, 120, "corpus_query_count");
assert.equal(raw.length, 600, "raw_result_count");
assert.deepEqual(report.manifest.systems, ["lexical", "semantic", "graph", "hybrid", "mirai_planner"], "systems");
assert.match(report.manifest.model_revision, /^[a-f0-9]{40,64}$/, "model_revision");
assert.match(report.manifest.model_files_digest, /^sha256:[a-f0-9]{64}$/, "model_files_digest");
assert.match(report.manifest.implementation_revision, /^[a-f0-9]{40}$/, "implementation_revision");
execFileSync("git", ["merge-base", "--is-ancestor", report.manifest.implementation_revision, "HEAD"], { cwd: root });
assert.equal(report.release_gate_status, "passed_with_limitations", "release_gate_status");
assert.equal(report.safety.unauthorized_hits, 0, "unauthorized_hits");
assert.equal(report.safety.unsupported_claims, "none_detected", "unsupported_claims");
assert.equal(report.safety.semantic_fallback, "not_applicable", "semantic_fallback");
assert.equal(report.safety.canonical_write_allowed, false, "canonical_write_allowed");

const metrics = report.systems.mirai_planner.aggregate;
const minimums = {
  recall_at_k: 0.8,
  ndcg_at_k: 0.6,
  mrr: 0.8,
  intent_accuracy: 0.8,
  evidence_coverage: 1,
  claim_faithfulness: 1,
  conflict_detection_rate: 0.95,
  stale_detection_rate: 0.95
};
for (const [name, minimum] of Object.entries(minimums)) assert.ok(metrics[name] >= minimum, `${name}:${metrics[name]}<${minimum}`);
assert.equal(metrics.conflict_case_count, 12, "conflict_case_count");
assert.equal(metrics.stale_case_count, 12, "stale_case_count");
assert.equal(metrics.unauthorized_hit_count, 0, "planner_unauthorized_hits");

const evaluationSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas/retrieval-evaluation.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEvaluation = ajv.compile(evaluationSchema);
for (const [system, value] of Object.entries(report.systems)) {
  const cases = raw.filter((item) => item.system === system).map((item) => item.evaluation_case);
  const reconstructed = evaluateRetrieval(corpus.id, system, cases, 10);
  assert.deepEqual(reconstructed, value.aggregate, `${system}:aggregate_reconstruction`);
  assert.equal(validateEvaluation(value.aggregate), true, `${system}:aggregate_schema:${ajv.errorsText(validateEvaluation.errors)}`);
  for (const domain of corpus.domains) {
    const domainCases = raw.filter((item) => item.system === system && item.domain === domain).map((item) => item.evaluation_case);
    const domainReconstructed = evaluateRetrieval(`${corpus.id}.${domain}`, system, domainCases, 10);
    assert.deepEqual(domainReconstructed, value.domains[domain], `${system}:${domain}:reconstruction`);
    assert.equal(validateEvaluation(value.domains[domain]), true, `${system}:${domain}:schema:${ajv.errorsText(validateEvaluation.errors)}`);
  }
}

process.stdout.write(`${JSON.stringify({
  status: "passed_with_limitations",
  corpus_digest: corpus.digest,
  report_digest: report.digest,
  raw_results: raw.length,
  thresholds: minimums,
  observed: Object.fromEntries(Object.keys(minimums).map((key) => [key, metrics[key]])),
  unauthorized_hits: 0,
  canonical_writes: 0
}, null, 2)}\n`);
