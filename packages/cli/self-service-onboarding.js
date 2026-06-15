#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

const profiles = [
  {
    profile: "software_specification",
    aliases: ["software", "developer", "engineer"],
    template: "templates/software-project-starter",
    markers: ["package.json", "src", "lib", "app", "components", "tests"]
  },
  {
    profile: "project_management",
    aliases: ["researcher", "research", "science"],
    template: "templates/research-program-starter",
    markers: ["research", "manuscript", "evidence", "methodology", "roadmap", "publication"]
  },
  {
    profile: "ai_employee",
    aliases: ["ai-employee", "ai_employee", "agent", "employee"],
    template: "templates/ai-employee-starter",
    markers: ["agent", "ai employee", "tool", "policy", "approval", "workflow"]
  },
  {
    profile: "character_layer",
    aliases: ["character", "character-layer", "behavior", "behaviour"],
    template: "templates/character-layer-starter",
    markers: ["constitution", "principle", "reflection", "boundary", "character", "virtue"]
  },
  {
    profile: "organization_governance",
    aliases: ["organization", "org", "governance"],
    template: "templates/organization-governance-starter",
    markers: ["organization", "department", "policy", "governance", "strategy", "metric"]
  }
];

function usage() {
  console.error("Usage:");
  console.error("  self-service-onboarding init [target-dir] --profile <profile> [--template <template>] [--force]");
  console.error("  self-service-onboarding detect [target-dir] [--json|--markdown]");
  console.error("  self-service-onboarding bootstrap [target-dir] --mode detect|suggest [--profile auto|<profile>] [--output <dir>] [--json|--markdown]");
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === "force" || key === "json" || key === "markdown") {
      flags[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = next;
    index += 1;
  }
  return { positionals, flags };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveProfile(input) {
  const value = String(input || "").trim().toLowerCase().replace(/_/g, "-");
  const found = profiles.find((item) => {
    if (item.profile.replace(/_/g, "-") === value) return true;
    return item.aliases.some((alias) => alias.replace(/_/g, "-") === value);
  });
  if (!found) {
    throw new Error(`Unknown profile: ${input}. Known profiles: ${profiles.map((item) => item.profile).join(", ")}`);
  }
  return found;
}

function resolveTemplate(templateInput, profileInfo) {
  const template = templateInput || profileInfo.template;
  const templatePath = path.isAbsolute(template) ? template : path.resolve(root, template);
  if (!fs.existsSync(path.join(templatePath, "mirai-graph-package.json"))) {
    throw new Error(`Template is missing mirai-graph-package.json: ${template}`);
  }
  return templatePath;
}

function packagePaths(targetDir) {
  return [
    "mirai-graph-package.json",
    path.join("graph", "objects.json"),
    path.join("graph", "relations.json"),
    path.join("gates", "results.json")
  ].map((relativePath) => ({
    relativePath,
    absolutePath: path.join(targetDir, relativePath)
  }));
}

function copyFileSafe(source, target, force) {
  if (fs.existsSync(target) && !force) {
    throw new Error(`Refusing to overwrite existing file without --force: ${target}`);
  }
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function initPackage(targetDir, flags) {
  if (!flags.profile && !flags.template) {
    throw new Error("init requires --profile or --template");
  }
  const profileInfo = flags.profile ? resolveProfile(flags.profile) : resolveProfile("software_specification");
  const templatePath = resolveTemplate(flags.template, profileInfo);
  const force = Boolean(flags.force);
  const target = path.resolve(targetDir || process.cwd());

  const files = packagePaths(target);
  const existing = files.filter((entry) => fs.existsSync(entry.absolutePath)).map((entry) => entry.relativePath);
  if (existing.length > 0 && !force) {
    throw new Error(`Target already has graph files: ${existing.join(", ")}. Re-run with --force only if you intend to replace these starter files.`);
  }

  copyFileSafe(path.join(templatePath, "mirai-graph-package.json"), path.join(target, "mirai-graph-package.json"), force);
  copyFileSafe(path.join(templatePath, "graph", "objects.json"), path.join(target, "graph", "objects.json"), force);
  copyFileSafe(path.join(templatePath, "graph", "relations.json"), path.join(target, "graph", "relations.json"), force);
  if (fs.existsSync(path.join(templatePath, "gates", "results.json"))) {
    copyFileSafe(path.join(templatePath, "gates", "results.json"), path.join(target, "gates", "results.json"), force);
  }

  const manifest = readJson(path.join(target, "mirai-graph-package.json"));
  return {
    mode: "init",
    status: "created",
    target_dir: target,
    profile: manifest.profile,
    template: path.relative(root, templatePath),
    files_created: packagePaths(target).filter((entry) => fs.existsSync(entry.absolutePath)).map((entry) => entry.relativePath),
    overwritten: force,
    canonical_write_allowed: true,
    next_safe_action: `mirai-graph validate ${target}`
  };
}

function listCandidateFiles(targetDir) {
  const names = ["README.md", "package.json", "pyproject.toml", "composer.json", "docs", "src", "app", "lib", "research", "source"];
  return names.filter((name) => fs.existsSync(path.join(targetDir, name)));
}

function readBoundedText(targetDir, candidates) {
  const texts = [];
  for (const candidate of candidates) {
    const filePath = path.join(targetDir, candidate);
    if (!fs.existsSync(filePath)) continue;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      texts.push(candidate);
      continue;
    }
    if (stat.size > 200000) continue;
    texts.push(candidate);
    texts.push(fs.readFileSync(filePath, "utf8").slice(0, 12000));
  }
  return texts.join("\n").toLowerCase();
}

function classifyProject(targetDir) {
  const candidates = listCandidateFiles(targetDir);
  const text = readBoundedText(targetDir, candidates);
  const scores = profiles.map((item) => {
    const score = item.markers.reduce((total, marker) => total + (text.includes(marker.toLowerCase()) ? 1 : 0), 0);
    return { profile: item.profile, template: item.template, score };
  }).sort((a, b) => b.score - a.score);
  const best = scores[0];
  const fallback = best && best.score > 0 ? best : profiles[0];
  return {
    detected_files: candidates,
    scores,
    recommended_profile: fallback.profile,
    recommended_template: fallback.template,
    confidence: best && best.score >= 2 ? "medium" : "low"
  };
}

function detectProject(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const files = packagePaths(target);
  const missing = files.filter((entry) => !fs.existsSync(entry.absolutePath)).map((entry) => entry.relativePath);
  const present = files.filter((entry) => fs.existsSync(entry.absolutePath)).map((entry) => entry.relativePath);
  const classification = classifyProject(target);
  const hasManifest = fs.existsSync(path.join(target, "mirai-graph-package.json"));
  const hasCoreGraph = fs.existsSync(path.join(target, "graph", "objects.json")) && fs.existsSync(path.join(target, "graph", "relations.json"));
  const graphPresence = hasManifest && hasCoreGraph ? "present" : present.length > 0 ? "incomplete" : "missing";

  return {
    mode: "detect",
    target_dir: target,
    status: "ready",
    project_classification: {
      recommended_profile: classification.recommended_profile,
      confidence: classification.confidence,
      scores: classification.scores,
      detected_files: classification.detected_files
    },
    graph_presence: graphPresence,
    recommended_profile: classification.recommended_profile,
    recommended_template: classification.recommended_template,
    source_boundary_findings: [
      "Read-only detection uses repository metadata and bounded top-level files.",
      "Private data is not copied into the report.",
      "Generated proposal/evidence is not canonical graph state."
    ],
    missing_artifacts: missing,
    proposal_ref: null,
    canonical_write_allowed: false,
    next_safe_action: graphPresence === "present"
      ? `mirai-graph validate ${target}`
      : `mirai-graph bootstrap ${target} --mode suggest`
  };
}

function markdownReport(report) {
  const lines = [];
  lines.push("# Mirai Graph Self-Service Report");
  lines.push("");
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Target: \`${report.target_dir}\``);
  lines.push(`- Status: \`${report.status}\``);
  lines.push(`- Graph presence: \`${report.graph_presence || "n/a"}\``);
  lines.push(`- Recommended profile: \`${report.recommended_profile || report.profile || "n/a"}\``);
  lines.push(`- Recommended template: \`${report.recommended_template || report.template || "n/a"}\``);
  lines.push(`- Canonical write allowed: \`${report.canonical_write_allowed}\``);
  lines.push(`- Next safe action: \`${report.next_safe_action}\``);
  if (Array.isArray(report.missing_artifacts) && report.missing_artifacts.length > 0) {
    lines.push("");
    lines.push("## Missing Artifacts");
    for (const item of report.missing_artifacts) lines.push(`- \`${item}\``);
  }
  if (report.proposal_ref) {
    lines.push("");
    lines.push(`Proposal: \`${report.proposal_ref}\``);
  }
  lines.push("");
  lines.push("Boundary: this report does not authorize canonical graph updates.");
  return `${lines.join("\n")}\n`;
}

function bootstrapProject(targetDir, flags) {
  const mode = flags.mode || "detect";
  if (!["detect", "suggest"].includes(mode)) {
    throw new Error("bootstrap --mode must be detect or suggest");
  }
  const target = path.resolve(targetDir || process.cwd());
  const detected = detectProject(target);
  if (mode === "detect") {
    return { ...detected, mode: "bootstrap_detect" };
  }

  const profileInfo = flags.profile && flags.profile !== "auto"
    ? resolveProfile(flags.profile)
    : resolveProfile(detected.recommended_profile);
  const output = path.resolve(flags.output || path.join(target, "mirai-graph", "bootstrap-proposal"));
  ensureDir(output);
  const proposal = {
    schema_version: "0.1.0",
    id: "bootstrap_proposal.self_service",
    mode: "bootstrap_suggest",
    target_dir: target,
    project_classification: detected.project_classification,
    graph_presence: detected.graph_presence,
    recommended_profile: profileInfo.profile,
    recommended_template: profileInfo.template,
    candidate_objects: [
      {
        "id": "evidence.project_readme_or_manifest",
        "kind": "evidence",
        "title": "Project README or Manifest",
        "summary": "Bounded project metadata detected during self-service bootstrap."
      },
      {
        "id": "project.detected_system",
        "kind": "project",
        "title": "Detected Project",
        "summary": "Initial project object candidate for adopter review."
      }
    ],
    candidate_relations: [
      {
        "id": "relation.project.detected_system.evidenced_by.evidence.project_readme_or_manifest",
        "type": "evidenced_by",
        "source": "project.detected_system",
        "target": "evidence.project_readme_or_manifest"
      }
    ],
    source_boundary_findings: detected.source_boundary_findings,
    missing_artifacts: detected.missing_artifacts,
    canonical_write_allowed: false,
    next_safe_action: `mirai-graph init ${target} --profile ${profileInfo.profile}`
  };
  const proposalPath = path.join(output, "bootstrap-proposal.json");
  const reportPath = path.join(output, "bootstrap-proposal.md");
  writeJson(proposalPath, proposal);
  fs.writeFileSync(reportPath, markdownReport({
    ...detected,
    mode: "bootstrap_suggest",
    recommended_profile: profileInfo.profile,
    recommended_template: profileInfo.template,
    proposal_ref: proposalPath,
    next_safe_action: proposal.next_safe_action
  }));
  return {
    ...detected,
    mode: "bootstrap_suggest",
    recommended_profile: profileInfo.profile,
    recommended_template: profileInfo.template,
    proposal_ref: proposalPath,
    output_dir: output,
    canonical_write_allowed: false,
    next_safe_action: proposal.next_safe_action
  };
}

function printResult(result, flags) {
  if (flags.markdown) {
    process.stdout.write(markdownReport(result));
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  const { positionals, flags } = parseArgs(argv);
  const targetDir = positionals[0] || process.cwd();
  let result;

  if (command === "init") {
    result = initPackage(targetDir, flags);
  } else if (command === "detect") {
    result = detectProject(targetDir);
  } else if (command === "bootstrap") {
    result = bootstrapProject(targetDir, flags);
  } else {
    usage();
    process.exit(1);
  }

  printResult(result, flags);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
