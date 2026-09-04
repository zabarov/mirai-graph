#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const report = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/mirai-2.4-retrieval/results/evaluation-report.json"), "utf8"));
const raw = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/mirai-2.4-retrieval/results/raw-results.json"), "utf8"));
const domains = ["federation", "larena", "ai_employee", "organization"];
for (const domain of domains) {
  const systems = Object.fromEntries(Object.entries(report.systems).map(([name, value]) => [name, value.domains[domain]]));
  const body = {
    contract_version: "1.0.0",
    pilot_id: `pilot.mirai-2.4-retrieval.${domain}`,
    domain,
    mode: "synthetic_benchmark_slice",
    corpus_digest: report.manifest.corpus_digest,
    query_count: new Set(raw.filter((item) => item.domain === domain).map((item) => item.query_id)).size,
    systems,
    safety: report.safety,
    review: {
      reviewer_class: "internal_generator",
      verdict: "synthetic_only",
      evidence_ref: "benchmarks/mirai-2.4-retrieval/results/evaluation-report.json",
      claim_boundary: "This is a deterministic domain slice of the synthetic benchmark, not an independent controlled pilot."
    },
    limitations: [
      "The pilot uses a frozen public-safe controlled corpus rather than private production data.",
      "Relevance judgments were authored with the corpus and were not blinded from its designer.",
      "No independent pilot claim is made by this generated artifact."
    ],
    canonical_write_allowed: false
  };
  const target = path.join(root, `pilots/mirai-2.4-retrieval-${domain}/results`);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "pilot-result.json"), `${JSON.stringify({ ...body, digest: digestValue(body) }, null, 2)}\n`);
  fs.writeFileSync(path.join(path.dirname(target), "README.md"), `# Mirai 2.4 Retrieval Benchmark Slice: ${domain}\n\nStatus: synthetic public-safe benchmark slice\n\nThis read-only benchmark slice evaluates frozen queries for the ${domain} domain across lexical, semantic, graph, hybrid and Mirai planner conditions. It performs no production effects or canonical writes and is not an independent controlled pilot. See \`results/pilot-result.json\` for metrics, safety outcomes and limitations.\n`);
}
process.stdout.write(`${JSON.stringify({ status: "generated", synthetic_slices: domains, independent_pilot_claim: false }, null, 2)}\n`);
