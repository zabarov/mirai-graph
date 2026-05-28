#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("Usage: node packages/cli/seed-preview.js <seed-file> [--write <output-file>]");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function titleFromFamily(family) {
  return family
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildEmbryo(seed) {
  const maxObjects = Math.max(1, Math.min(seed.growth_rules.max_initial_objects || 1, 8));
  const families = (seed.growth_rules.allowed_object_families || []).slice(0, maxObjects);
  const profile = seed.target_profile.replace(/^profile\./, "");
  const candidateObjects = families.map((family, index) => ({
    id: `${family}.candidate_${index + 1}`,
    kind: family,
    title: `Candidate ${titleFromFamily(family)}`,
    summary: `Candidate ${family} object proposed from seed ${seed.seed_id}.`,
    readiness: "draft",
    evidence: [],
    profile
  }));

  return {
    schema_version: "0.1.0",
    embryo_id: `embryo.${seed.seed_id.replace(/^seed\./, "")}`,
    seed_id: seed.seed_id,
    generated_at: new Date().toISOString(),
    candidate_objects: candidateObjects,
    candidate_relations: [],
    uncertain_items: [
      "This is a deterministic seed preview, not extracted canonical graph state."
    ],
    review_questions: [
      "Do the candidate object families match the graph purpose?",
      "Are source boundaries sufficient for the first extraction pass?",
      "Should canonical write remain blocked until human review?"
    ],
    stop_conditions_triggered: []
  };
}

const seedPath = process.argv[2];
const writeFlagIndex = process.argv.indexOf("--write");
const outputPath = writeFlagIndex >= 0 ? process.argv[writeFlagIndex + 1] : null;

if (!seedPath || (writeFlagIndex >= 0 && !outputPath)) {
  usage();
  process.exit(2);
}

try {
  const seed = readJson(path.resolve(seedPath));
  const embryo = buildEmbryo(seed);
  const output = JSON.stringify(embryo, null, 2);

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
