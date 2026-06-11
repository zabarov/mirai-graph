#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function list(items, emptyText) {
  if (!items || items.length === 0) {
    return `- ${emptyText}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

const packageDir = process.argv[2] || "examples/instrumentation-layer-minimal";
const resultsDir = path.join(packageDir, "results");
const cockpit = readJson(path.join(resultsDir, "development-cockpit.json"));
const traceability = readJson(path.join(resultsDir, "feature-implementation-traceability.json"));
const feedback = readJson(path.join(resultsDir, "multi-source-quality-feedback.json"));

const cockpitInstruments = cockpit.instruments.map(
  (instrument) => `\`${instrument.id}\` ${instrument.family}: ${instrument.score}/${100} (${instrument.band})`
);
const mappings = traceability.implementation_mappings.map(
  (mapping) => `\`${mapping.feature_ref}\` -> ${mapping.implementation_refs.length} implementation refs, ${mapping.test_refs.length} test refs, ${mapping.evidence_refs.length} evidence refs`
);
const findings = feedback.findings.map(
  (finding) => `\`${finding.id}\` ${finding.classification}, severity ${finding.severity}, blocking ${finding.blocking ? "true" : "false"}, route ${finding.next_route}`
);

const lines = [
  "# Mirai Graph Instrumentation Report",
  "",
  `- Package: \`${packageDir}\``,
  `- Cockpit: \`${cockpit.id}\``,
  `- Traceability: \`${traceability.id}\``,
  `- Multi-source feedback: \`${feedback.id}\``,
  `- Transition verdict: \`${feedback.verdict}\``,
  `- Next transition: \`${feedback.next_transition}\``,
  "",
  "## Control Pattern",
  "",
  "```text",
  "feature intent -> implementation traceability -> cockpit signals -> multi-source feedback -> transition decision -> Kaizen route",
  "```",
  "",
  "## Cockpit",
  "",
  `- Subject: \`${cockpit.subject_ref}\``,
  `- Production readiness: \`${cockpit.readiness.production_readiness}\``,
  `- Next action: \`${cockpit.next_best_action.action}\``,
  `- Target cycle: \`${cockpit.next_best_action.target_cycle}\``,
  "",
  "### Instruments",
  "",
  list(cockpitInstruments, "No cockpit instruments declared."),
  "",
  "### Required Gates",
  "",
  list(cockpit.next_best_action.required_gates, "No required gates declared."),
  "",
  "## Traceability",
  "",
  `- Features: \`${traceability.coverage_summary.feature_count}\``,
  `- Mapped features: \`${traceability.coverage_summary.mapped_feature_count}\``,
  `- Evidence-backed mappings: \`${traceability.coverage_summary.evidence_backed_mapping_count}\``,
  `- Accepted features: \`${traceability.coverage_summary.accepted_feature_count}\``,
  "",
  "### Mappings",
  "",
  list(mappings, "No mappings declared."),
  "",
  "## Multi-Source Feedback",
  "",
  `- Sources: \`${feedback.sources.length}\``,
  `- Findings: \`${feedback.findings.length}\``,
  `- Blocking findings: \`${feedback.blocking_findings.length}\``,
  "",
  "### Findings",
  "",
  list(findings, "No findings declared."),
  "",
  "### Kaizen Refs",
  "",
  list(feedback.kaizen_refs, "No Kaizen refs declared."),
  "",
  "## Boundary",
  "",
  "- Cockpit scores are not acceptance.",
  "- Feature mappings are not implementation by themselves.",
  "- Tests and evidence do not authorize canonical updates.",
  "- Multi-source feedback calibrates transition decisions; blocking findings stop the transitions they block."
];

console.log(lines.join("\n"));
