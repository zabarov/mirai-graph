#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

const profiles = [
  {
    role: "developer",
    aliases: ["developer", "software", "software_specification", "engineer"],
    profile: "software_specification",
    starter: "templates/software-project-starter",
    useWhen: "features, requirements, components, implementation tasks and technical risks",
    nextCommands: [
      "node packages/cli/mirai-graph.js validate templates/software-project-starter",
      "node packages/cli/mirai-graph.js report validation templates/software-project-starter",
      "node packages/cli/mirai-graph.js adopter report templates/software-project-starter"
    ]
  },
  {
    role: "researcher",
    aliases: ["researcher", "research", "science", "project_management"],
    profile: "project_management",
    starter: "templates/research-program-starter",
    useWhen: "hypotheses, evidence, milestones, review gates and publication risks",
    nextCommands: [
      "node packages/cli/mirai-graph.js validate templates/research-program-starter",
      "node packages/cli/mirai-graph.js report validation templates/research-program-starter",
      "node packages/cli/mirai-graph.js adopter report templates/research-program-starter"
    ]
  },
  {
    role: "ai-employee",
    aliases: ["ai-employee", "ai_employee", "agent", "ai", "employee"],
    profile: "ai_employee",
    starter: "templates/ai-employee-starter",
    useWhen: "AI worker roles, skills, tools, policies, actions, feedback and learning gates",
    nextCommands: [
      "node packages/cli/mirai-graph.js validate templates/ai-employee-starter",
      "node packages/cli/mirai-graph.js report validation templates/ai-employee-starter",
      "node packages/cli/mirai-graph.js adopter report templates/ai-employee-starter"
    ]
  },
  {
    role: "character-layer",
    aliases: ["character-layer", "character_layer", "character", "behavior", "behaviour", "behavior-governance"],
    profile: "character_layer",
    starter: "templates/character-layer-starter",
    useWhen: "behavior constitution, role character profiles, reflection, violation patterns and correction loops",
    nextCommands: [
      "node packages/cli/mirai-graph.js validate templates/character-layer-starter",
      "node packages/cli/mirai-graph.js report validation templates/character-layer-starter",
      "node packages/cli/mirai-graph.js adopter report templates/character-layer-starter"
    ]
  },
  {
    role: "organization",
    aliases: ["organization", "org", "governance", "organization_governance"],
    profile: "organization_governance",
    starter: "templates/organization-governance-starter",
    useWhen: "mission, strategy, departments, programs, policies, controls and metrics",
    nextCommands: [
      "node packages/cli/mirai-graph.js validate templates/organization-governance-starter",
      "node packages/cli/mirai-graph.js report validation templates/organization-governance-starter",
      "node packages/cli/mirai-graph.js adopter report templates/organization-governance-starter"
    ]
  }
];

function usage() {
  console.error("Usage:");
  console.error("  adopter-workflow choose-profile");
  console.error("  adopter-workflow plan <role-or-profile>");
  console.error("  adopter-workflow report <template-dir>");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveProfile(input) {
  const normalized = String(input || "").trim().toLowerCase().replace(/_/g, "-");
  return profiles.find((item) => {
    if (item.role === normalized) return true;
    if (item.profile.replace(/_/g, "-") === normalized) return true;
    return item.aliases.some((alias) => alias.replace(/_/g, "-") === normalized);
  });
}

function printProfileMap() {
  console.log("# Mirai Graph Profile Selection");
  console.log("");
  console.log("| Role | Profile | Starter | Use when |");
  console.log("| --- | --- | --- | --- |");
  for (const item of profiles) {
    console.log(`| ${item.role} | \`${item.profile}\` | \`${item.starter}\` | ${item.useWhen} |`);
  }
  console.log("");
  console.log("Boundary: profile selection is a starting point, not adoption proof.");
}

function printPlan(input) {
  const item = resolveProfile(input);
  if (!item) {
    console.error(`Unknown role or profile: ${input}`);
    console.error(`Known roles: ${profiles.map((profile) => profile.role).join(", ")}`);
    process.exit(1);
  }

  console.log(`# Mirai Graph Adopter Plan: ${item.role}`);
  console.log("");
  console.log(`- Profile: \`${item.profile}\``);
  console.log(`- Starter: \`${item.starter}\``);
  console.log(`- Use when: ${item.useWhen}.`);
  console.log("");
  console.log("## First Workflow");
  console.log("");
  console.log("```text");
  console.log("choose profile -> copy starter -> replace synthetic objects -> validate -> report -> launch/evidence/kaizen");
  console.log("```");
  console.log("");
  console.log("## Commands");
  console.log("");
  console.log("```bash");
  for (const command of item.nextCommands) {
    console.log(command);
  }
  console.log("```");
  console.log("");
  console.log("## Review Boundary");
  console.log("");
  console.log("- Validation confirms current alpha package shape only.");
  console.log("- Reports support review; they do not authorize canonical updates.");
  console.log("- Add launch, evidence and Kaizen controls before using the package for governed work.");
}

function templateReport(templateDir) {
  const absTemplate = path.resolve(root, templateDir);
  const manifestPath = path.join(absTemplate, "mirai-graph-package.json");
  const objectsPath = path.join(absTemplate, "graph", "objects.json");
  const relationsPath = path.join(absTemplate, "graph", "relations.json");
  const gatesPath = path.join(absTemplate, "gates", "results.json");

  const missing = [manifestPath, objectsPath, relationsPath].filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    console.error(`Template is missing required files: ${missing.map((filePath) => path.relative(root, filePath)).join(", ")}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const objects = readJson(objectsPath);
  const relations = readJson(relationsPath);
  const gates = fs.existsSync(gatesPath) ? readJson(gatesPath) : [];
  const profile = profiles.find((item) => item.profile === manifest.profile);

  console.log(`# Mirai Graph Adopter Report: ${manifest.name}`);
  console.log("");
  console.log(`- Package: \`${manifest.id}\``);
  console.log(`- Profile: \`${manifest.profile}\``);
  console.log(`- Conformance: \`${manifest.conformance_level || "unspecified"}\``);
  console.log(`- Public safety: \`${manifest.public_safety || "unspecified"}\``);
  console.log(`- Objects: \`${objects.length}\``);
  console.log(`- Relations: \`${relations.length}\``);
  console.log(`- Gate results: \`${gates.length}\``);
  console.log("");

  if (profile) {
    console.log("## Recommended Next Commands");
    console.log("");
    console.log("```bash");
    for (const command of profile.nextCommands) {
      console.log(command.replace(profile.starter, templateDir));
    }
    console.log("```");
    console.log("");
  }

  console.log("## Adoption Checklist");
  console.log("");
  console.log("- Replace synthetic objects with project-specific objects.");
  console.log("- Keep private source material outside public graph packages.");
  console.log("- Run validation before adding launch or process-control artifacts.");
  console.log("- Add evidence references before promoting readiness.");
  console.log("- Add launch/evidence/Kaizen controls before governed execution.");
  console.log("");
  console.log("## Boundary");
  console.log("");
  console.log("This report is an adoption aid. It does not prove completeness, authorize production execution or update canonical graph state.");
}

const [command, ...args] = process.argv.slice(2);

if (!command || command === "--help" || command === "-h") {
  usage();
  process.exit(command ? 0 : 1);
}

if (command === "choose-profile") {
  if (args.length !== 0) {
    usage();
    process.exit(1);
  }
  printProfileMap();
  process.exit(0);
}

if (command === "plan") {
  if (args.length !== 1) {
    usage();
    process.exit(1);
  }
  printPlan(args[0]);
  process.exit(0);
}

if (command === "report") {
  if (args.length !== 1) {
    usage();
    process.exit(1);
  }
  templateReport(args[0]);
  process.exit(0);
}

usage();
process.exit(1);
