#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { buildLocalRetrievalIndex, evaluateRetrieval, readRetrievalConfig, searchLocalRetrievalIndex } = require("../../dist/cjs/retrieval");

async function main() {
  const root = path.resolve(__dirname, "../../examples/mirai-retrieval-minimal");
  const config = readRetrievalConfig(root);
  const descriptor = await buildLocalRetrievalIndex(root, { built_at: "2026-09-04T00:00:00.000Z" });
  const request = { contract_version: "1.0.0", id: "query.release-policy", query: "release policy", intent: "policy_lookup", access: config.access, freshness_required: "current", canonical_write_allowed: false };
  const result = await searchLocalRetrievalIndex(root, request);
  const evaluation = evaluateRetrieval("corpus.mirai-retrieval-minimal", "mirai_planner", [{ expected_document_ids: ["unit.release-policy"], expected_intent: "policy_lookup", predicted_intent: result.plan.intent, hits: result.evidence.hits, answer: result.answer, latency_ms: 5, claim_faithfulness: 1 }]);
  const output = path.join(root, "results");
  fs.mkdirSync(output, { recursive: true });
  const artifacts = { "index-descriptor.json": descriptor, "request.json": request, "plan.json": result.plan, "evidence-bundle.json": result.evidence, "answer.json": result.answer, "evaluation.json": evaluation };
  for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: "generated", files: Object.keys(artifacts), result_digest: digestValue(Object.values(artifacts).map((item) => item.digest || digestValue(item))) }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
