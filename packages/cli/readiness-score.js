#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("Usage: node packages/cli/readiness-score.js <package-dir> [--target-mode discovery|canonical|pilot|controlled_runtime|production_runtime] [--write <output-file>]");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findManifestPath(packageDir) {
  const preferredPath = path.join(packageDir, "mirai-graph-package.json");
  const legacyPath = path.join(packageDir, "mirai-graph-package.json");
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  return preferredPath;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function scorePackage(packageDir, targetMode) {
  const manifestPath = findManifestPath(packageDir);
  const graphObjectsPath = path.join(packageDir, "graph", "objects.json");
  const graphRelationsPath = path.join(packageDir, "graph", "relations.json");
  const gateResultsPath = path.join(packageDir, "gates", "results.json");

  const evidence = [];
  const blockers = [];
  const manifest = exists(manifestPath) ? readJson(manifestPath) : null;
  let score = 0;

  if (manifest) {
    score += 10;
    evidence.push("package manifest exists");
  } else {
    blockers.push("missing package manifest");
  }

  if (exists(graphObjectsPath) && exists(graphRelationsPath)) {
    const objects = readJson(graphObjectsPath);
    const relations = readJson(graphRelationsPath);
    if (Array.isArray(objects) && objects.length > 0) {
      score += 15;
      evidence.push(`objects exist: ${objects.length}`);
    }
    if (Array.isArray(relations)) {
      score += 10;
      evidence.push(`relations exist: ${relations.length}`);
    }
    const evidenceObjects = Array.isArray(objects)
      ? objects.filter((object) => object.kind === "evidence").length
      : 0;
    if (evidenceObjects > 0) {
      score += 15;
      evidence.push(`evidence objects exist: ${evidenceObjects}`);
    }
    const acceptedObjects = Array.isArray(objects)
      ? objects.filter((object) => object.readiness === "accepted").length
      : 0;
    if (acceptedObjects > 0) {
      score += 10;
      evidence.push(`accepted objects exist: ${acceptedObjects}`);
    }
  } else {
    blockers.push("missing graph objects or relations");
  }

  if (exists(gateResultsPath)) {
    const gateResults = readJson(gateResultsPath);
    if (Array.isArray(gateResults) && gateResults.length > 0) {
      score += 15;
      evidence.push(`gate results exist: ${gateResults.length}`);
    }
  }

  const contextPackPath = path.join(packageDir, "expected", "context-pack-compact.md");
  if (exists(contextPackPath)) {
    score += 10;
    evidence.push("context pack example exists");
  }

  const metricsPath = path.join(packageDir, "metrics", "example-metrics.json");
  if (exists(metricsPath)) {
    score += 10;
    evidence.push("benchmark metric example exists");
  }

  const caps = [];
  if (blockers.length > 0) {
    caps.push({ reason: "structural blockers exist", max_score: 39 });
  }
  if (targetMode !== "discovery" && !exists(gateResultsPath)) {
    caps.push({ reason: "no gate results for non-discovery target", max_score: 59 });
  }
  if (["pilot", "controlled_runtime", "production_runtime"].includes(targetMode) && !exists(metricsPath)) {
    caps.push({ reason: "no benchmark evidence for pilot/runtime target", max_score: 69 });
  }
  if (
    manifest &&
    typeof manifest.public_safety === "string" &&
    manifest.public_safety.includes("synthetic") &&
    ["pilot", "controlled_runtime", "production_runtime"].includes(targetMode)
  ) {
    caps.push({ reason: "synthetic-only evidence cannot exceed pilot-ready navigation score", max_score: 69 });
  }
  if (["controlled_runtime", "production_runtime"].includes(targetMode)) {
    caps.push({ reason: "runtime policy is not implemented in public alpha", max_score: 74 });
  }

  for (const cap of caps) {
    score = Math.min(score, cap.max_score);
  }

  return {
    schema_version: "0.1.0",
    target_mode: targetMode,
    score,
    band: score < 20
      ? "G0_raw"
      : score < 40
        ? "G1_extracted"
        : score < 60
          ? "G2_canonical"
          : score < 75
            ? "G3_pilot_ready"
            : score < 90
              ? "G4_controlled_runtime_candidate"
              : "G5_runtime_stable",
    evidence,
    blockers,
    caps,
    note: "Alpha readiness score; use as navigation, not approval."
  };
}

const packageDir = process.argv[2];
const targetModeIndex = process.argv.indexOf("--target-mode");
const writeFlagIndex = process.argv.indexOf("--write");
const targetMode = targetModeIndex >= 0 ? process.argv[targetModeIndex + 1] : "discovery";
const outputPath = writeFlagIndex >= 0 ? process.argv[writeFlagIndex + 1] : null;

if (!packageDir || (targetModeIndex >= 0 && !targetMode) || (writeFlagIndex >= 0 && !outputPath)) {
  usage();
  process.exit(2);
}

try {
  const result = scorePackage(path.resolve(packageDir), targetMode);
  const output = JSON.stringify(result, null, 2);

  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
    fs.writeFileSync(resolvedOutputPath, `${output}\n`);
  }

  console.log(output);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
