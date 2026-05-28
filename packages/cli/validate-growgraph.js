#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const readinessValues = new Set([
  "draft",
  "review_ready",
  "accepted",
  "blocked",
  "deprecated"
]);

const coreObjectKinds = new Set([
  "system",
  "goal",
  "requirement",
  "feature",
  "decision",
  "risk",
  "task",
  "component",
  "evidence",
  "context_pack",
  "governance_gate",
  "profile"
]);

const coreRelationTypes = new Set([
  "depends_on",
  "supports",
  "blocks",
  "implements",
  "evidences",
  "contradicts",
  "governs",
  "requires_approval_from",
  "generates",
  "derived_from",
  "supersedes",
  "belongs_to",
  "related_to"
]);

const conformanceLevels = new Set([
  "level_0",
  "level_1",
  "level_2",
  "level_3",
  "level_4"
]);

const gateVerdicts = new Set([
  "pass",
  "pass_with_notes",
  "blocked",
  "rejected",
  "needs_more_evidence"
]);

function usage() {
  console.error("Usage:");
  console.error("  node packages/cli/validate-growgraph.js <package-dir>");
  console.error("  node packages/cli/validate-growgraph.js seed <seed-file>");
  console.error("  node packages/cli/validate-growgraph.js profile <profile-file>");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function asArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  return value;
}

function requireString(item, field, label, errors) {
  if (typeof item[field] !== "string" || item[field].trim() === "") {
    errors.push(`${label}.${field} must be a non-empty string`);
  }
}

function requireArray(item, field, label, errors) {
  if (!Array.isArray(item[field])) {
    errors.push(`${label}.${field} must be an array`);
    return;
  }
  const seen = new Set();
  for (const value of item[field]) {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${label}.${field} must contain only non-empty strings`);
      continue;
    }
    if (seen.has(value)) {
      errors.push(`${label}.${field} contains duplicate value ${value}`);
    }
    seen.add(value);
  }
}

function canonicalRelationId(relation) {
  if (
    typeof relation.source !== "string" ||
    typeof relation.type !== "string" ||
    typeof relation.target !== "string"
  ) {
    return null;
  }
  return `relation.${relation.source}.${relation.type}.${relation.target}`;
}

function validatePackage(packageDir) {
  const manifestPath = path.join(packageDir, "growgraph-package.json");
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const graphDir = path.join(packageDir, "graph");
  const objectsPath = manifest
    ? path.join(packageDir, manifest.graph && manifest.graph.objects ? manifest.graph.objects : "")
    : path.join(graphDir, "objects.json");
  const relationsPath = manifest
    ? path.join(packageDir, manifest.graph && manifest.graph.relations ? manifest.graph.relations : "")
    : path.join(graphDir, "relations.json");
  const gateResultsPath = path.join(packageDir, "gates", "results.json");
  const errors = [];
  const warnings = [];

  if (manifest) {
    requireString(manifest, "id", "manifest", errors);
    requireString(manifest, "name", "manifest", errors);
    requireString(manifest, "version", "manifest", errors);
    requireString(manifest, "profile", "manifest", errors);
    requireString(manifest, "conformance_level", "manifest", errors);

    if (!manifest.graph || typeof manifest.graph !== "object") {
      errors.push("manifest.graph must be an object");
    } else {
      requireString(manifest.graph, "objects", "manifest.graph", errors);
      requireString(manifest.graph, "relations", "manifest.graph", errors);
    }

    if (
      typeof manifest.conformance_level === "string" &&
      !conformanceLevels.has(manifest.conformance_level)
    ) {
      errors.push(`manifest.conformance_level has unsupported value ${manifest.conformance_level}`);
    }
  } else {
    warnings.push("Missing growgraph-package.json manifest");
  }

  if (!fs.existsSync(objectsPath)) {
    errors.push(`Missing ${objectsPath}`);
  }
  if (!fs.existsSync(relationsPath)) {
    errors.push(`Missing ${relationsPath}`);
  }
  if (errors.length > 0) {
    return { errors, warnings };
  }

  const objects = asArray(readJson(objectsPath), "graph/objects.json", errors);
  const relations = asArray(readJson(relationsPath), "graph/relations.json", errors);
  const objectIds = new Set();

  for (const [index, object] of objects.entries()) {
    const label = `object[${index}]`;
    requireString(object, "id", label, errors);
    requireString(object, "kind", label, errors);
    requireString(object, "title", label, errors);
    requireString(object, "summary", label, errors);
    requireString(object, "readiness", label, errors);
    requireString(object, "profile", label, errors);
    requireArray(object, "evidence", label, errors);

    if (typeof object.id === "string") {
      if (objectIds.has(object.id)) {
        errors.push(`${label}.id duplicates ${object.id}`);
      }
      objectIds.add(object.id);
    }

    if (typeof object.readiness === "string" && !readinessValues.has(object.readiness)) {
      errors.push(`${label}.readiness has unsupported value ${object.readiness}`);
    }

    if (typeof object.kind === "string" && object.profile === "core" && !coreObjectKinds.has(object.kind)) {
      warnings.push(`${label}.kind ${object.kind} is not a core object kind`);
    }
  }

  const evidenceIds = new Set(
    objects
      .filter((object) => object.kind === "evidence")
      .map((object) => object.id)
  );
  const relationIds = new Set();

  for (const [index, relation] of relations.entries()) {
    const label = `relation[${index}]`;
    requireString(relation, "id", label, errors);
    requireString(relation, "type", label, errors);
    requireString(relation, "source", label, errors);
    requireString(relation, "target", label, errors);
    requireString(relation, "readiness", label, errors);
    requireString(relation, "profile", label, errors);
    requireArray(relation, "evidence", label, errors);

    if (typeof relation.id === "string") {
      if (relationIds.has(relation.id)) {
        errors.push(`${label}.id duplicates ${relation.id}`);
      }
      relationIds.add(relation.id);

      const expectedRelationId = canonicalRelationId(relation);
      if (expectedRelationId && relation.id !== expectedRelationId) {
        errors.push(`${label}.id must be ${expectedRelationId} for its source/type/target`);
      }
    }

    if (typeof relation.source === "string" && !objectIds.has(relation.source)) {
      errors.push(`${label}.source references missing object ${relation.source}`);
    }

    if (typeof relation.target === "string" && !objectIds.has(relation.target)) {
      errors.push(`${label}.target references missing object ${relation.target}`);
    }

    if (typeof relation.readiness === "string" && !readinessValues.has(relation.readiness)) {
      errors.push(`${label}.readiness has unsupported value ${relation.readiness}`);
    }

    if (typeof relation.type === "string" && relation.profile === "core" && !coreRelationTypes.has(relation.type)) {
      warnings.push(`${label}.type ${relation.type} is not a core relation type`);
    }

    if (Array.isArray(relation.evidence)) {
      for (const evidenceRef of relation.evidence) {
        if (!evidenceIds.has(evidenceRef) && !objectIds.has(evidenceRef)) {
          warnings.push(`${label}.evidence references non-object evidence ${evidenceRef}`);
        }
      }
    }
  }

  if (fs.existsSync(gateResultsPath)) {
    const gateResults = asArray(readJson(gateResultsPath), "gates/results.json", errors);
    const gateResultIds = new Set();

    for (const [index, gateResult] of gateResults.entries()) {
      const label = `gate_result[${index}]`;
      requireString(gateResult, "id", label, errors);
      requireString(gateResult, "gate_id", label, errors);
      requireString(gateResult, "target_id", label, errors);
      requireString(gateResult, "verdict", label, errors);
      requireString(gateResult, "summary", label, errors);
      requireString(gateResult, "reviewed_at", label, errors);
      requireArray(gateResult, "evidence", label, errors);

      if (typeof gateResult.id === "string") {
        if (gateResultIds.has(gateResult.id)) {
          errors.push(`${label}.id duplicates ${gateResult.id}`);
        }
        gateResultIds.add(gateResult.id);
      }

      if (typeof gateResult.verdict === "string" && !gateVerdicts.has(gateResult.verdict)) {
        errors.push(`${label}.verdict has unsupported value ${gateResult.verdict}`);
      }

      if (
        typeof gateResult.target_id === "string" &&
        manifest &&
        gateResult.target_id !== manifest.id &&
        !objectIds.has(gateResult.target_id) &&
        !relationIds.has(gateResult.target_id)
      ) {
        warnings.push(`${label}.target_id references non-graph target ${gateResult.target_id}`);
      }
    }
  }

  return { errors, warnings };
}

function requireObject(item, field, label, errors) {
  if (!item[field] || typeof item[field] !== "object" || Array.isArray(item[field])) {
    errors.push(`${label}.${field} must be an object`);
  }
}

function validateSeed(seedPath) {
  const errors = [];
  const warnings = [];
  const seed = readJson(seedPath);
  const label = "seed";

  requireString(seed, "schema_version", label, errors);
  requireString(seed, "seed_id", label, errors);
  requireString(seed, "target_graph_id", label, errors);
  requireString(seed, "purpose", label, errors);
  requireString(seed, "target_profile", label, errors);
  requireString(seed, "target_mode", label, errors);
  requireObject(seed, "graph_dna", label, errors);
  requireObject(seed, "source_boundaries", label, errors);
  requireObject(seed, "growth_rules", label, errors);
  requireArray(seed, "review_gates", label, errors);
  requireArray(seed, "generated_views", label, errors);
  requireArray(seed, "stop_conditions", label, errors);

  const targetModes = new Set([
    "discovery",
    "canonical",
    "pilot",
    "controlled_runtime",
    "production_runtime"
  ]);

  if (typeof seed.target_mode === "string" && !targetModes.has(seed.target_mode)) {
    errors.push(`${label}.target_mode has unsupported value ${seed.target_mode}`);
  }

  if (seed.graph_dna && typeof seed.graph_dna === "object") {
    requireString(seed.graph_dna, "purpose", "seed.graph_dna", errors);
    requireString(seed.graph_dna, "evolution_vector", "seed.graph_dna", errors);
    requireArray(seed.graph_dna, "non_negotiable_principles", "seed.graph_dna", errors);
  }

  if (seed.source_boundaries && typeof seed.source_boundaries === "object") {
    requireArray(seed.source_boundaries, "allowed_sources", "seed.source_boundaries", errors);
    requireArray(seed.source_boundaries, "excluded_sources", "seed.source_boundaries", errors);
    if (typeof seed.source_boundaries.canonical_write_allowed !== "boolean") {
      errors.push("seed.source_boundaries.canonical_write_allowed must be a boolean");
    }
  }

  if (seed.growth_rules && typeof seed.growth_rules === "object") {
    requireArray(seed.growth_rules, "allowed_object_families", "seed.growth_rules", errors);
    requireArray(seed.growth_rules, "allowed_relation_families", "seed.growth_rules", errors);
    if (!Number.isInteger(seed.growth_rules.max_initial_objects) || seed.growth_rules.max_initial_objects < 1) {
      errors.push("seed.growth_rules.max_initial_objects must be a positive integer");
    }
    if (!["light", "standard", "broad"].includes(seed.growth_rules.depth_mode)) {
      errors.push("seed.growth_rules.depth_mode must be light, standard or broad");
    }
  }

  if (
    seed.source_boundaries &&
    seed.source_boundaries.canonical_write_allowed === true &&
    Array.isArray(seed.review_gates) &&
    !seed.review_gates.includes("human_review_before_canonical_write")
  ) {
    warnings.push("canonical_write_allowed is true without human_review_before_canonical_write gate");
  }

  return { errors, warnings };
}

function validateProfile(profilePath) {
  const errors = [];
  const warnings = [];
  const profile = readJson(profilePath);
  const label = "profile";

  requireString(profile, "id", label, errors);
  requireString(profile, "name", label, errors);
  requireString(profile, "version", label, errors);
  requireString(profile, "description", label, errors);
  requireArray(profile, "allowed_object_kinds", label, errors);
  requireArray(profile, "allowed_relation_types", label, errors);
  requireString(profile, "default_readiness", label, errors);
  requireArray(profile, "governance_gates", label, errors);

  if (typeof profile.default_readiness === "string" && !readinessValues.has(profile.default_readiness)) {
    errors.push(`${label}.default_readiness has unsupported value ${profile.default_readiness}`);
  }

  if (Array.isArray(profile.allowed_object_kinds) && profile.allowed_object_kinds.length === 0) {
    warnings.push("profile.allowed_object_kinds is empty");
  }

  if (Array.isArray(profile.allowed_relation_types) && profile.allowed_relation_types.length === 0) {
    warnings.push("profile.allowed_relation_types is empty");
  }

  return { errors, warnings };
}

const modeOrPackageDir = process.argv[2];
if (!modeOrPackageDir) {
  usage();
  process.exit(2);
}

try {
  const isSeedMode = modeOrPackageDir === "seed";
  const isProfileMode = modeOrPackageDir === "profile";
  const targetPath = isSeedMode || isProfileMode ? process.argv[3] : modeOrPackageDir;
  if (!targetPath) {
    usage();
    process.exit(2);
  }
  const result = isSeedMode
    ? validateSeed(path.resolve(targetPath))
    : isProfileMode
      ? validateProfile(path.resolve(targetPath))
    : validatePackage(path.resolve(targetPath));
  const output = {
    mode: isSeedMode ? "seed" : isProfileMode ? "profile" : "package",
    target: path.resolve(targetPath),
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(output.valid ? 0 : 1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
