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
const processControl = readJson("examples/process-control-contract-minimal/results/process-control-contract.json");

const lines = [
  "# GrowGraph Playground Demo Report",
  "",
  "Status: deterministic alpha demo",
  "",
  "## Control Loop",
  "",
  "```text",
  "seed -> graph -> context -> launch -> transition -> evidence -> kaizen",
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
  `- Process-control contract: \`${processControl.id}\``,
  "",
  "## Commands",
  "",
  "```bash",
  "npm run validate:minimal",
  "npm run seed:preview",
  "npm run context:generate",
  "npm run validate:launch-record",
  "npm run validate:process-transition",
  "npm run validate:process-control",
  "npm run validate:implementation-control-cycles",
  "```",
  "",
  "## What This Demonstrates",
  "",
  "- GrowGraph can validate a graph package.",
  "- GrowGraph can generate task-specific context from graph state.",
  "- Launch records describe bounded work permission.",
  "- Process transitions are checked against an executable state machine.",
  "- Process-control contracts bind launch, evidence, recovery and Kaizen policy.",
  "",
  "## Boundaries",
  "",
  "- This is a public-safe synthetic demo.",
  "- Generated context is not canonical state.",
  "- Evidence and proposals do not authorize canonical updates.",
  "- Synthetic evidence is not broad scientific proof."
];

console.log(lines.join("\n"));
