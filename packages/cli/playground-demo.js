#!/usr/bin/env node

const fs = require("fs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countItems(filePath) {
  const value = readJson(filePath);
  return Array.isArray(value) ? value.length : 0;
}

const packageDir = "benchmarks/synthetic-context-reduction-v0";
const objectsCount = countItems(`${packageDir}/graph/objects.json`);
const relationsCount = countItems(`${packageDir}/graph/relations.json`);
const contextPack = readJson(`${packageDir}/results/context-pack.json`);
const launchRecord = readJson("examples/launch-record-minimal/results/launch-record.json");
const transition = readJson("examples/process-transition-minimal/transition-request.json");
const transitionExplanation = readJson("examples/process-transition-minimal/results/transition-explanation-valid.json");
const processControl = readJson("examples/process-control-contract-minimal/results/process-control-contract.json");
const baselineComparison = readJson(`${packageDir}/results/baseline-comparison-result.json`);
const cockpit = readJson("examples/instrumentation-layer-minimal/results/development-cockpit.json");
const traceability = readJson("examples/instrumentation-layer-minimal/results/feature-implementation-traceability.json");
const feedback = readJson("examples/instrumentation-layer-minimal/results/multi-source-quality-feedback.json");

const lines = [
  "# Mirai Graph Playground Demo Report",
  "",
  "Status: deterministic 1.0.0-rc.6 demo",
  "",
  "## Control Loop",
  "",
  "```text",
  "seed -> graph -> context -> launch -> transition explanation -> cockpit -> traceability -> multi-source feedback -> evidence -> kaizen -> baseline comparison",
  "```",
  "",
  "## Demo Inputs",
  "",
  `- Synthetic package: \`${packageDir}\``,
  `- Objects: \`${objectsCount}\``,
  `- Relations: \`${relationsCount}\``,
  `- Context pack: \`${contextPack.id}\``,
  `- Launch record: \`${launchRecord.id}\``,
  `- Transition request: \`${transition.id}\``,
  `- Transition explanation: \`${transitionExplanation.fixture_id}\``,
  `- Process-control contract: \`${processControl.id}\``,
  `- Development cockpit: \`${cockpit.id}\``,
  `- Feature traceability: \`${traceability.id}\``,
  `- Multi-source feedback: \`${feedback.id}\``,
  `- Baseline comparison: \`${baselineComparison.id}\``,
  "",
  "## Commands",
  "",
  "```bash",
  "npm run validate:minimal",
  "npm run seed:preview",
  "npm run context:generate",
  "npm run validate:launch-record",
  "npm run validate:process-transition",
  "npm run validate:process-transition-report",
  "npm run validate:process-control",
  "npm run validate:instrumentation-layer",
  "npm run validate:instrumentation-report",
  "npm run validate:implementation-control-cycles",
  "npm run validate:baseline-comparison",
  "```",
  "",
  "## Transition Explanation",
  "",
  `- Requested transition: \`${transitionExplanation.explanation.current_state} -> ${transitionExplanation.explanation.target_state}\``,
  `- Matched transition: \`${transitionExplanation.explanation.matched_transition ? "true" : "false"}\``,
  `- Required evidence: \`${transitionExplanation.explanation.required_evidence.join(", ")}\``,
  `- Missing evidence: \`${transitionExplanation.explanation.missing_evidence.length}\``,
  `- Kaizen decision: \`${transitionExplanation.explanation.kaizen_decision.status}\``,
  "",
  "## Instrumentation",
  "",
  `- Cockpit production readiness: \`${cockpit.readiness.production_readiness}\``,
  `- Cockpit next action: \`${cockpit.next_best_action.action}\``,
  `- Feature mappings: \`${traceability.coverage_summary.mapped_feature_count}\``,
  `- Evidence-backed mappings: \`${traceability.coverage_summary.evidence_backed_mapping_count}\``,
  `- Multi-source feedback verdict: \`${feedback.verdict}\``,
  `- Blocking findings: \`${feedback.blocking_findings.length}\``,
  `- Kaizen refs: \`${feedback.kaizen_refs.join(", ")}\``,
  "",
  "## Baseline Comparison",
  "",
  `- Baseline context units: \`${baselineComparison.baseline.context_units}\``,
  `- Mirai Graph context units: \`${baselineComparison.mirai_graph.context_units}\``,
  `- Context reduction: \`${baselineComparison.outcome.context_reduction_percent}%\``,
  `- Baseline missed dependencies: \`${baselineComparison.baseline.missed_dependencies}\``,
  `- Mirai Graph missed dependencies: \`${baselineComparison.mirai_graph.missed_dependencies}\``,
  `- Verdict: \`${baselineComparison.outcome.verdict}\``,
  "",
  "## What This Demonstrates",
  "",
  "- Mirai Graph can validate a graph package.",
  "- Mirai Graph can generate task-specific context from graph state.",
  "- Launch records describe bounded work permission.",
  "- Process transitions are checked and explained against an executable state machine.",
  "- Process-control contracts bind launch, evidence, recovery and Kaizen policy.",
  "- Instrumentation connects cockpit signals, feature traceability and multi-source feedback.",
  "- Baseline comparison records synthetic measurement boundaries.",
  "",
  "## Boundaries",
  "",
  "- This is a public-safe synthetic demo.",
  "- Generated context is not canonical state.",
  "- Evidence and proposals do not authorize canonical updates.",
  "- Synthetic evidence is not broad scientific proof."
];

console.log(lines.join("\n"));
