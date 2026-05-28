#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("Usage: node packages/cli/context-pack.js <package-dir> --task-id <task-id> [--write <output-file>]");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
  const objectIds = objects.map((object) => object.id);
  const relationIds = relations.map((relation) => relation.id);
  const evidence = Array.from(new Set([
    ...objects.flatMap((object) => object.evidence || []),
    ...relations.flatMap((relation) => relation.evidence || [])
  ]));

  return {
    id: `context_pack.${taskId.replace(/[^a-zA-Z0-9_]+/g, "_")}`,
    task_id: taskId,
    source_graph: manifest ? manifest.id : packageDir,
    generated_at: new Date().toISOString(),
    included_objects: objectIds,
    included_relations: relationIds,
    evidence,
    assumptions: [
      "Alpha generator includes the full package graph; task-specific selection is not implemented yet."
    ],
    omissions: [],
    limitations: [
      "Generated context pack is not canonical state.",
      "This alpha generator does not score relevance or semantic completeness."
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
