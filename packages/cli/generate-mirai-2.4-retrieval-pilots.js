#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const report = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/mirai-2.4-retrieval/results/evaluation-report.json"), "utf8"));
const domains = ["federation", "larena", "ai_employee", "organization"];
for (const domain of domains) {
  const systems = Object.fromEntries(Object.entries(report.systems).map(([name, value]) => [name, value.domains[domain]]));
  const body = {
    contract_version: "1.0.0",
    pilot_id: `pilot.mirai-2.4-retrieval.${domain}`,
    domain,
    mode: "read_only_public_safe",
    corpus_digest: report.manifest.corpus_digest,
    query_count: report.manifest.query_count / domains.length,
    systems,
    safety: report.safety,
    review: {
      reviewer_class: "independent_ai_reviewer",
      verdict: "accepted_for_engineering_release",
      evidence_ref: "docs/security/mirai-2.4-independent-ai-review.md",
      claim_boundary: "Accepted as bounded engineering evidence; not independent human validation or proof of universal retrieval superiority."
    },
    limitations: [
      "The pilot uses a frozen public-safe controlled corpus rather than private production data.",
      "Relevance judgments were authored with the corpus and were not blinded from its designer.",
      "Independent review was AI-assisted; a human domain-owner replication remains post-release work."
    ],
    canonical_write_allowed: false
  };
  const target = path.join(root, `pilots/mirai-2.4-retrieval-${domain}/results`);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "pilot-result.json"), `${JSON.stringify({ ...body, digest: digestValue(body) }, null, 2)}\n`);
  fs.writeFileSync(path.join(path.dirname(target), "README.md"), `# Mirai 2.4 Retrieval Pilot: ${domain}\n\nStatus: controlled public-safe engineering pilot\n\nThis read-only pilot evaluates 30 frozen queries for the ${domain} domain across lexical, semantic, graph, hybrid and Mirai planner conditions. It performs no production effects or canonical writes. See \`results/pilot-result.json\` for metrics, safety outcomes, review class and limitations.\n`);
}
process.stdout.write(`${JSON.stringify({ status: "generated", pilots: domains }, null, 2)}\n`);
