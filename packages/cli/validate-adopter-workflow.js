#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const node = process.execPath;
const cli = path.join(root, "packages", "cli", "mirai-graph.js");

const checks = [
  {
    name: "profile map",
    args: ["choose-profile"],
    includes: ["Mirai Graph Profile Selection", "software_specification", "organization_governance"]
  },
  {
    name: "developer plan",
    args: ["adopter", "plan", "developer"],
    includes: ["Mirai Graph Adopter Plan: developer", "software-project-starter", "launch/evidence/kaizen"]
  },
  {
    name: "ai employee plan",
    args: ["adopter", "plan", "ai_employee"],
    includes: ["Mirai Graph Adopter Plan: ai-employee", "ai_employee", "ai-employee-starter"]
  },
  {
    name: "organization report",
    args: ["adopter", "report", "templates/organization-governance-starter"],
    includes: ["Mirai Graph Adopter Report", "organization_governance", "Adoption Checklist"]
  }
];

const errors = [];

for (const check of checks) {
  const result = spawnSync(node, [cli, ...check.args], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    errors.push(`${check.name}: command failed with exit ${result.status}`);
    continue;
  }
  const output = `${result.stdout}\n${result.stderr}`;
  for (const expected of check.includes) {
    if (!output.includes(expected)) {
      errors.push(`${check.name}: missing expected text ${JSON.stringify(expected)}`);
    }
  }
}

const result = {
  mode: "adopter_workflow",
  valid: errors.length === 0,
  checked_commands: checks.map((check) => `mirai-graph ${check.args.join(" ")}`),
  errors
};

console.log(JSON.stringify(result, null, 2));

if (errors.length > 0) {
  process.exit(1);
}
