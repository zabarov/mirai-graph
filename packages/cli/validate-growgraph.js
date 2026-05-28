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
  console.error("  node packages/cli/validate-growgraph.js context-pack <package-dir> <context-pack-file>");
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

function requireJsonArray(item, field, label, errors) {
  if (!Array.isArray(item[field])) {
    errors.push(`${label}.${field} must be an array`);
  }
}

function requireOptionalArray(item, field, label, errors) {
  if (item[field] === undefined) {
    return;
  }
  requireArray(item, field, label, errors);
}

function isValidDateTime(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
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

function profileSlug(profileName) {
  return profileName.replace(/_/g, "-");
}

function loadProfile(profileName) {
  if (profileName === "core") {
    return {
      allowed_object_kinds: Array.from(coreObjectKinds),
      allowed_relation_types: Array.from(coreRelationTypes)
    };
  }

  const profilePath = path.resolve(__dirname, "..", "..", "profiles", profileSlug(profileName), "profile.json");
  if (!fs.existsSync(profilePath)) {
    return null;
  }

  return readJson(profilePath);
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
  const packageProfile = manifest && typeof manifest.profile === "string" ? loadProfile(manifest.profile) : null;
  const allowedObjectKinds = packageProfile ? new Set(packageProfile.allowed_object_kinds || []) : null;
  const allowedRelationTypes = packageProfile ? new Set(packageProfile.allowed_relation_types || []) : null;

  if (manifest && typeof manifest.profile === "string" && !packageProfile) {
    warnings.push(`No local profile definition found for manifest.profile ${manifest.profile}`);
  }

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

    if (typeof object.kind === "string" && allowedObjectKinds && !allowedObjectKinds.has(object.kind)) {
      errors.push(`${label}.kind ${object.kind} is not allowed by manifest.profile ${manifest.profile}`);
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

    if (typeof relation.type === "string" && allowedRelationTypes && !allowedRelationTypes.has(relation.type)) {
      errors.push(`${label}.type ${relation.type} is not allowed by manifest.profile ${manifest.profile}`);
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

function loadPackageGraph(packageDir, errors) {
  const manifestPath = path.join(packageDir, "growgraph-package.json");
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const graphDir = path.join(packageDir, "graph");
  const objectsPath = manifest
    ? path.join(packageDir, manifest.graph && manifest.graph.objects ? manifest.graph.objects : "")
    : path.join(graphDir, "objects.json");
  const relationsPath = manifest
    ? path.join(packageDir, manifest.graph && manifest.graph.relations ? manifest.graph.relations : "")
    : path.join(graphDir, "relations.json");

  if (!fs.existsSync(objectsPath)) {
    errors.push(`Missing ${objectsPath}`);
  }
  if (!fs.existsSync(relationsPath)) {
    errors.push(`Missing ${relationsPath}`);
  }
  if (errors.length > 0) {
    return { manifest, objects: [], relations: [] };
  }

  return {
    manifest,
    objects: asArray(readJson(objectsPath), "graph/objects.json", errors),
    relations: asArray(readJson(relationsPath), "graph/relations.json", errors)
  };
}

function validateStringSet(values, knownIds, label, errors) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`${label} contains duplicate value ${value}`);
    }
    seen.add(value);
    if (!knownIds.has(value)) {
      errors.push(`${label} references unknown id ${value}`);
    }
  }
}

function validateContextPack(packageDir, contextPackPath) {
  const errors = [];
  const warnings = [];
  const { manifest, objects, relations } = loadPackageGraph(packageDir, errors);
  if (errors.length > 0) {
    return { errors, warnings };
  }

  const contextPack = readJson(contextPackPath);
  const label = "context_pack";
  requireString(contextPack, "id", label, errors);
  requireString(contextPack, "task_id", label, errors);
  requireString(contextPack, "source_graph", label, errors);
  requireString(contextPack, "generated_at", label, errors);
  requireArray(contextPack, "included_objects", label, errors);
  requireArray(contextPack, "included_relations", label, errors);
  requireArray(contextPack, "evidence", label, errors);
  requireArray(contextPack, "limitations", label, errors);
  requireOptionalArray(contextPack, "assumptions", label, errors);
  requireOptionalArray(contextPack, "omissions", label, errors);

  if (typeof contextPack.id === "string" && !contextPack.id.startsWith("context_pack.")) {
    warnings.push("context_pack.id should start with context_pack.");
  }

  if (contextPack.generated_at !== undefined && !isValidDateTime(contextPack.generated_at)) {
    errors.push("context_pack.generated_at must be a parseable date-time string");
  }

  if (manifest && contextPack.source_graph !== manifest.id) {
    errors.push(`context_pack.source_graph must match manifest.id ${manifest.id}`);
  }

  if (Array.isArray(contextPack.limitations) && contextPack.limitations.length === 0) {
    warnings.push("context_pack.limitations is empty");
  }

  const objectIds = new Set(objects.map((object) => object.id));
  const relationIds = new Set(relations.map((relation) => relation.id));
  const evidenceObjectIds = new Set(
    objects
      .filter((object) => object.kind === "evidence")
      .map((object) => object.id)
  );

  if (Array.isArray(contextPack.included_objects)) {
    validateStringSet(contextPack.included_objects, objectIds, "context_pack.included_objects", errors);
  }
  if (Array.isArray(contextPack.included_relations)) {
    validateStringSet(contextPack.included_relations, relationIds, "context_pack.included_relations", errors);
  }
  if (Array.isArray(contextPack.evidence)) {
    validateStringSet(contextPack.evidence, objectIds, "context_pack.evidence", errors);
    for (const evidenceId of contextPack.evidence) {
      if (objectIds.has(evidenceId) && !evidenceObjectIds.has(evidenceId)) {
        warnings.push(`context_pack.evidence includes non-evidence object ${evidenceId}`);
      }
    }
  }

  const selectedObjectIds = new Set(Array.isArray(contextPack.included_objects) ? contextPack.included_objects : []);
  for (const relation of relations) {
    if (!Array.isArray(contextPack.included_relations) || !contextPack.included_relations.includes(relation.id)) {
      continue;
    }
    if (!selectedObjectIds.has(relation.source)) {
      errors.push(`included relation ${relation.id} has source outside included_objects: ${relation.source}`);
    }
    if (!selectedObjectIds.has(relation.target)) {
      errors.push(`included relation ${relation.id} has target outside included_objects: ${relation.target}`);
    }
  }

  if (!contextPack.selection) {
    warnings.push("context_pack.selection is missing; generated packs should explain selection metadata");
    return { errors, warnings };
  }

  if (typeof contextPack.selection !== "object" || Array.isArray(contextPack.selection)) {
    errors.push("context_pack.selection must be an object");
    return { errors, warnings };
  }

  requireString(contextPack.selection, "method", "context_pack.selection", errors);
  requireArray(contextPack.selection, "task_tokens", "context_pack.selection", errors);
  requireJsonArray(contextPack.selection, "object_explanations", "context_pack.selection", errors);
  requireJsonArray(contextPack.selection, "relation_explanations", "context_pack.selection", errors);

  if (Array.isArray(contextPack.selection.task_tokens) && contextPack.selection.task_tokens.length === 0) {
    warnings.push("context_pack.selection.task_tokens is empty");
  }

  const explainedObjectIds = new Set();
  if (Array.isArray(contextPack.selection.object_explanations)) {
    for (const [index, explanation] of contextPack.selection.object_explanations.entries()) {
      const explanationLabel = `context_pack.selection.object_explanations[${index}]`;
      requireString(explanation, "id", explanationLabel, errors);
      requireArray(explanation, "reasons", explanationLabel, errors);

      if (typeof explanation.relevance_score !== "number" || !Number.isFinite(explanation.relevance_score)) {
        errors.push(`${explanationLabel}.relevance_score must be a finite number`);
      }
      if (typeof explanation.id === "string") {
        if (explainedObjectIds.has(explanation.id)) {
          errors.push(`${explanationLabel}.id duplicates ${explanation.id}`);
        }
        explainedObjectIds.add(explanation.id);
        if (!selectedObjectIds.has(explanation.id)) {
          errors.push(`${explanationLabel}.id must reference included object ${explanation.id}`);
        }
      }
      if (Array.isArray(explanation.reasons) && explanation.reasons.length === 0) {
        warnings.push(`${explanationLabel}.reasons is empty`);
      }
    }
  }

  for (const objectId of selectedObjectIds) {
    if (!explainedObjectIds.has(objectId)) {
      errors.push(`included object ${objectId} is missing selection.object_explanations entry`);
    }
  }

  const selectedRelationIds = new Set(Array.isArray(contextPack.included_relations) ? contextPack.included_relations : []);
  const explainedRelationIds = new Set();
  if (Array.isArray(contextPack.selection.relation_explanations)) {
    for (const [index, explanation] of contextPack.selection.relation_explanations.entries()) {
      const explanationLabel = `context_pack.selection.relation_explanations[${index}]`;
      requireString(explanation, "id", explanationLabel, errors);
      requireString(explanation, "reason", explanationLabel, errors);
      requireString(explanation, "source", explanationLabel, errors);
      requireString(explanation, "target", explanationLabel, errors);
      if (typeof explanation.id === "string") {
        if (explainedRelationIds.has(explanation.id)) {
          errors.push(`${explanationLabel}.id duplicates ${explanation.id}`);
        }
        explainedRelationIds.add(explanation.id);
        if (!selectedRelationIds.has(explanation.id)) {
          errors.push(`${explanationLabel}.id must reference included relation ${explanation.id}`);
        }
      }
      if (typeof explanation.source === "string" && !selectedObjectIds.has(explanation.source)) {
        errors.push(`${explanationLabel}.source must reference an included object`);
      }
      if (typeof explanation.target === "string" && !selectedObjectIds.has(explanation.target)) {
        errors.push(`${explanationLabel}.target must reference an included object`);
      }
    }
  }

  for (const relationId of selectedRelationIds) {
    if (!explainedRelationIds.has(relationId)) {
      errors.push(`included relation ${relationId} is missing selection.relation_explanations entry`);
    }
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
  const isContextPackMode = modeOrPackageDir === "context-pack";
  const targetPath = isSeedMode || isProfileMode || isContextPackMode ? process.argv[3] : modeOrPackageDir;
  const contextPackPath = isContextPackMode ? process.argv[4] : null;
  if (!targetPath) {
    usage();
    process.exit(2);
  }
  if (isContextPackMode && !contextPackPath) {
    usage();
    process.exit(2);
  }
  const result = isSeedMode
    ? validateSeed(path.resolve(targetPath))
    : isProfileMode
      ? validateProfile(path.resolve(targetPath))
      : isContextPackMode
        ? validateContextPack(path.resolve(targetPath), path.resolve(contextPackPath))
        : validatePackage(path.resolve(targetPath));
  const output = {
    mode: isSeedMode ? "seed" : isProfileMode ? "profile" : isContextPackMode ? "context_pack" : "package",
    target: isContextPackMode ? path.resolve(contextPackPath) : path.resolve(targetPath),
    package: isContextPackMode ? path.resolve(targetPath) : undefined,
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
