#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("Usage: node packages/cli/context-pack.js <package-dir> --task-id <task-id> [--write <output-file>]");
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
    .split(/[^a-zA-Z0-9]+/u)
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

function addReason(selectionReasons, objectId, reason) {
  if (!selectionReasons.has(objectId)) {
    selectionReasons.set(objectId, new Set());
  }
  selectionReasons.get(objectId).add(reason);
}

function hasSharedEvidence(object, evidenceIds) {
  return Array.isArray(object.evidence) && object.evidence.some((id) => evidenceIds.has(id));
}

function isSafetyContextObject(object) {
  if (!["constraint", "risk", "governance_gate"].includes(object.kind) && !object.id.startsWith("gate.")) {
    return false;
  }
  const text = tokenize(objectText(object));
  const safetyTokens = new Set([
    "credential",
    "leak",
    "log",
    "permission",
    "privacy",
    "public",
    "safety",
    "secret",
    "security",
    "token"
  ]);
  return text.some((token) => safetyTokens.has(token));
}

function scoreObject(object, taskTokens) {
  const text = tokenize(objectText(object));
  const textSet = new Set(text);
  let score = 0;
  const reasons = [];
  for (const token of taskTokens) {
    if (textSet.has(token)) {
      score += 3;
      reasons.push(`exact token match: ${token}`);
    } else if (text.some((candidate) => candidate.includes(token) || token.includes(candidate))) {
      score += 1;
      reasons.push(`partial token match: ${token}`);
    }
  }
  if (object.kind === "evidence") {
    score -= 1;
    reasons.push("evidence object penalty until linked by selected graph context");
  }
  if (object.kind === "governance_gate" || object.id.startsWith("gate.")) {
    score += 1;
    reasons.push("governance gate boost");
  }
  return { score, reasons };
}

function buildContextPack(packageDir, taskId) {
  const manifestPath = findManifestPath(packageDir);
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
  const scoredObjects = objects.map((object) => ({
    object,
    ...scoreObject(object, taskTokens)
  }));
  const directMatches = objects
    .map((object) => scoredObjects.find((entry) => entry.object.id === object.id))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.object);

  const selectedIds = new Set(directMatches.map((object) => object.id));
  const selectionReasons = new Map();
  const objectScores = new Map(scoredObjects.map((entry) => [entry.object.id, entry.score]));

  for (const entry of scoredObjects) {
    if (entry.score > 0) {
      for (const reason of entry.reasons) {
        addReason(selectionReasons, entry.object.id, reason);
      }
    }
  }

  const relevantRelations = relations.filter((relation) => (
    selectedIds.has(relation.source) || selectedIds.has(relation.target)
  ));
  const relevantRelationIds = new Set(relevantRelations.map((relation) => relation.id));

  for (const relation of relevantRelations) {
    if (!selectedIds.has(relation.source)) {
      addReason(selectionReasons, relation.source, `one-hop relation expansion from ${relation.id}`);
    }
    if (!selectedIds.has(relation.target)) {
      addReason(selectionReasons, relation.target, `one-hop relation expansion from ${relation.id}`);
    }
    selectedIds.add(relation.source);
    selectedIds.add(relation.target);
  }

  const selectedEvidenceIds = new Set(
    objects
      .filter((object) => selectedIds.has(object.id))
      .flatMap((object) => object.evidence || [])
  );

  for (const object of objects) {
    if (isSafetyContextObject(object) && hasSharedEvidence(object, selectedEvidenceIds)) {
      if (!selectedIds.has(object.id)) {
        addReason(selectionReasons, object.id, "safety-sensitive object with shared evidence");
      }
      selectedIds.add(object.id);
    }
  }

  const expandedRelations = relations.filter((relation) => (
    selectedIds.has(relation.source) && selectedIds.has(relation.target)
  ));

  const selectedObjects = objects.filter((object) => (
    selectedIds.has(object.id) ||
    (object.kind === "evidence" && objects.some((selected) => (
      selectedIds.has(selected.id) && Array.isArray(selected.evidence) && selected.evidence.includes(object.id)
    )))
  ));
  for (const object of selectedObjects) {
    if (object.kind === "evidence" && !selectedIds.has(object.id)) {
      addReason(selectionReasons, object.id, "evidence referenced by selected object");
    }
  }
  const selectedObjectIds = selectedObjects.map((object) => object.id);
  const relationIds = expandedRelations.map((relation) => relation.id);
  const relationExplanations = expandedRelations.map((relation) => ({
    id: relation.id,
    reason: relevantRelationIds.has(relation.id)
      ? "one-hop relation expansion from direct object match"
      : "connects selected objects after safety/evidence expansion",
    source: relation.source,
    target: relation.target
  }));
  const objectExplanations = selectedObjects.map((object) => ({
    id: object.id,
    relevance_score: objectScores.get(object.id) || 0,
    reasons: Array.from(selectionReasons.get(object.id) || ["included as selected graph context"])
  }));
  const evidence = Array.from(new Set([
    ...selectedObjects.flatMap((object) => object.evidence || []),
    ...expandedRelations.flatMap((relation) => relation.evidence || [])
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
    selection: {
      method: "token_matching_one_hop_relation_expansion_safety_shared_evidence",
      task_tokens: taskTokens,
      object_explanations: objectExplanations,
      relation_explanations: relationExplanations
    },
    assumptions: [
      "Alpha generator uses token matching plus one-hop relation expansion.",
      "Safety-sensitive constraints and risks with shared evidence are included."
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
