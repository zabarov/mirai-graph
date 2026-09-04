import fs from "node:fs";
import path from "node:path";
import { computeAnalysis } from "./scoring.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packets = JSON.parse(fs.readFileSync(path.join(root, "03-data/condition-packets-v2.json"), "utf8"));
const raw = JSON.parse(fs.readFileSync(path.join(root, "results/raw-pilot.json"), "utf8"));
const analysis = computeAnalysis(packets, raw);
fs.writeFileSync(path.join(root, "results/pilot-analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`);
const lines = ["# Controlled Pilot Analysis v2", "", `Status: ${analysis.release_gate_recommendation}`, "", `Runs: ${analysis.run_count}; review groups: ${analysis.review_group_count}; provider cost: USD ${analysis.total_cost_usd.toFixed(4)}.`, "", "| Condition | Integrity | Exact status | Evidence refs | Hard failures | Blind usefulness | Input tokens |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |", ...analysis.aggregate.map((item) => `| ${item.condition} | ${item.outcome_integrity_score.toFixed(3)} | ${item.exact_status_rate.toFixed(3)} | ${item.evidence_reference_rate.toFixed(3)} | ${item.hard_failure_rate.toFixed(3)} | ${item.blind_usefulness.toFixed(3)} | ${item.input_tokens} |`), "", "This is bounded package-level engineering evidence. It is not external human review, causal isolation, production readiness or a universal effectiveness claim.", ""];
fs.writeFileSync(path.join(root, "05-analysis/controlled-pilot-analysis.md"), lines.join("\n"));
process.stdout.write(`${JSON.stringify({ valid: true, run_count: analysis.run_count, recommendation: analysis.release_gate_recommendation, digest: analysis.digest }, null, 2)}\n`);
