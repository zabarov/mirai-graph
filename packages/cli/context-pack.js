#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("Usage: node packages/cli/context-pack.js <package-dir> --task-id <task-id> [--write <output-file>]");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeToken(token) {
  const normalized = token.toLowerCase();
  const replacements = new Map([
    ["notification", "notify"],
    ["notifications", "notify"],
    ["notifying", "notify"],
    ["approval", "approve"],
    ["approved", "approve"],
    ["approving", "approve"],
    ["schedule", "schedule"],
    ["speaker", "speaker"],
    ["session", "session"],
    ["sessions", "session"]
  ]);
  if (replacements.has(normalized)) {
    return replacements.get(normalized);
  }
  return normalized
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/(ing|ed|ions|ion|s)$/u, "");
}

function tokenize(text) {
  return String(text)
    .split(/[^a-zA-Z0-9_]+/u)
    .map(normalizeToken)
    .filter((token) => token.length >= 3);
}

function objectText(object) {
  return [
    object.id,
    object.kind,
    object.title,
    object.summary,
    object.profile
  ].join(" ");
}

function scoreObject(object, taskTokens) {
  const text = tokenize(objectText(object));
  const textSet = new Set(text);
  let score = 0;
  for (const token of taskTokens) {
    if (textSet.has(token)) {
      score += 3;
    } else if (text.some((candidate) => candidate.includes(token) || token.includes(candidate))) {
      score += 1;
    }
  }
  if (object.kind === "evidence") {
    score -= 1;
  }
  if (object.kind === "governance_gate" || object.id.startsWith("gate.")) {
    score += 1;
  }
  return score;
}

function buildContextPack(packageDir, taskId) {
  const manifestPath = path.join(packageDir, "growgraph-package.json");
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const objectsPath = manifest
    ? path.join(packageDir, manifest.graph.objects)
    : path.join(packageDir, "graph", "objects.json");
  const relationsPath = manifest
    ? path.join(packageDir, manifest.graph.relations)
    : path.join(packageDir, "graph", "relations.json");
  const objects = readJson(objectsPath);
  const relations = readJson(relationsPath);
  const taskTokens = tokenize(taskId);
  const directMatches = objects
    .map((object) => ({ object, score: scoreObject(object, taskTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.object);

  const selectedIds = new Set(directMatches.map((object) => object.id));
  const relevantRelations = relations.filter((relation) => (
    selectedIds.has(relation.source) || selectedIds.has(relation.target)
  ));

  for (const relation of relevantRelations) {
    selectedIds.add(relation.source);
    selectedIds.add(relation.target);
  }

  const selectedObjects = objects.filter((object) => (
    selectedIds.has(object.id) ||
    (object.kind === "evidence" && objects.some((selected) => (
      selectedIds.has(selected.id) && Array.isArray(selected.evidence) && selected.evidence.includes(object.id)
    )))
  ));
  const selectedObjectIds = selectedObjects.map((object) => object.id);
  const relationIds = relevantRelations.map((relation) => relation.id);
  const evidence = Array.from(new Set([
    ...selectedObjects.flatMap((object) => object.evidence || []),
    ...relevantRelations.flatMap((relation) => relation.evidence || [])
  ]));
  const omittedObjects = objects
    .filter((object) => !selectedObjectIds.includes(object.id))
    .map((object) => object.id);

  return {
    id: `context_pack.${taskId.replace(/[^a-zA-Z0-9_]+/g, "_")}`,
    task_id: taskId,
    source_graph: manifest ? manifest.id : packageDir,
    generated_at: new Date().toISOString(),
    included_objects: selectedObjectIds,
    included_relations: relationIds,
    evidence,
    assumptions: [
      "Alpha generator uses token matching plus one-hop relation expansion."
    ],
    omissions: omittedObjects,
    limitations: [
      "Generated context pack is not canonical state.",
      "This alpha generator does not prove semantic completeness."
    ]
  };
}

const packageDir = process.argv[2];
const taskIndex = process.argv.indexOf("--task-id");
const writeIndex = process.argv.indexOf("--write");
const taskId = taskIndex >= 0 ? process.argv[taskIndex + 1] : null;
const outputPath = writeIndex >= 0 ? process.argv[writeIndex + 1] : null;

if (!packageDir || !taskId || (writeIndex >= 0 && !outputPath)) {
  usage();
  process.exit(2);
}

try {
  const contextPack = buildContextPack(path.resolve(packageDir), taskId);
  const output = JSON.stringify(contextPack, null, 2);

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
