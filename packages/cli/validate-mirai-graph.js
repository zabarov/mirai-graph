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
  console.error("  node packages/cli/validate-mirai-graph.js <package-dir>");
  console.error("  node packages/cli/validate-mirai-graph.js seed <seed-file>");
  console.error("  node packages/cli/validate-mirai-graph.js profile <profile-file>");
  console.error("  node packages/cli/validate-mirai-graph.js context-pack <package-dir> <context-pack-file>");
  console.error("  node packages/cli/validate-mirai-graph.js implementation-control-cycle <cycle-result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js launch-record <launch-record-file>");
  console.error("  node packages/cli/validate-mirai-graph.js process-transition <state-machine-file> <transition-request-file>");
  console.error("  node packages/cli/validate-mirai-graph.js process-control-contract <contract-file>");
  console.error("  node packages/cli/validate-mirai-graph.js technology-quality-feedback <feedback-file>");
  console.error("  node packages/cli/validate-mirai-graph.js graph-dna-alignment <result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js work-state-machine <result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js recovery-resume-record <result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js risk-control-matrix <result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js multi-agent-coordination <result-file>");
  console.error("  node packages/cli/validate-mirai-graph.js source-boundary-contract <result-file>");
  console.error("");
  console.error("Output options:");
  console.error("  --json       Print JSON output (default)");
  console.error("  --markdown   Print a human-readable Markdown report");
}

function markdownList(items, emptyText) {
  if (!items || items.length === 0) {
    return `- ${emptyText}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function formatMarkdownReport(output) {
  if (output.mode === "process_transition" && output.explanation) {
    const explanation = output.explanation;
    const gate = explanation.kaizen_decision || {};
    return [
      "# Process Transition Decision Report",
      "",
      `- Valid: \`${output.valid ? "true" : "false"}\``,
      `- Process: \`${explanation.process_id || "unknown"}\``,
      `- Transition: \`${explanation.current_state || "unknown"} -> ${explanation.target_state || "unknown"}\``,
      `- Matched transition: \`${explanation.matched_transition ? "true" : "false"}\``,
      `- Requires launch record: \`${explanation.requires_launch_record ? "true" : "false"}\``,
      `- Launch record satisfied: \`${explanation.launch_record_satisfied ? "true" : "false"}\``,
      `- Terminal transition: \`${explanation.terminal_transition ? "true" : "false"}\``,
      `- Kaizen decision: \`${gate.status || "not_required"}\``,
      "",
      "## Required Evidence",
      "",
      markdownList(explanation.required_evidence, "No evidence required by matched transition."),
      "",
      "## Provided Evidence",
      "",
      markdownList(explanation.provided_evidence, "No evidence provided."),
      "",
      "## Missing Evidence",
      "",
      markdownList(explanation.missing_evidence, "No missing evidence."),
      "",
      "## False-Transition Guards",
      "",
      markdownList(explanation.false_transition_guard_summary, "No false-transition guards declared."),
      "",
      "## Errors",
      "",
      markdownList(output.errors, "No errors."),
      "",
      "## Warnings",
      "",
      markdownList(output.warnings, "No warnings."),
      "",
      "## Boundary",
      "",
      "- A passing transition report validates this requested transition only.",
      "- Readiness, evidence and proposals do not authorize canonical updates."
    ].join("\n");
  }

  const lines = [
    "# Mirai Graph Validation Report",
    "",
    `- Mode: \`${output.mode}\``,
    `- Valid: \`${output.valid ? "true" : "false"}\``,
    `- Target: \`${output.target}\``
  ];

  if (output.package) {
    lines.push(`- Package: \`${output.package}\``);
  }
  if (output.state_machine) {
    lines.push(`- State machine: \`${output.state_machine}\``);
  }

  lines.push(
    "",
    "## Errors",
    "",
    markdownList(output.errors, "No errors."),
    "",
    "## Warnings",
    "",
    markdownList(output.warnings, "No warnings."),
    "",
    "## Boundary",
    "",
    "- A passing validation report is evidence for this check only.",
    "- Generated context, evidence and proposals do not authorize canonical updates."
  );

  return lines.join("\n");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function findManifestPath(packageDir) {
  const preferredPath = path.join(packageDir, "mirai-graph-package.json");
  const legacyPath = path.join(packageDir, "growgraph-package.json");
  if (fs.existsSync(preferredPath)) {
    return { path: preferredPath, legacy: false };
  }
  if (fs.existsSync(legacyPath)) {
    return { path: legacyPath, legacy: true };
  }
  return { path: preferredPath, legacy: false };
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
  const manifestLookup = findManifestPath(packageDir);
  const manifest = fs.existsSync(manifestLookup.path) ? readJson(manifestLookup.path) : null;
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
    if (manifestLookup.legacy) {
      warnings.push("Using legacy growgraph-package.json manifest; prefer mirai-graph-package.json");
    }

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
    warnings.push("Missing mirai-graph-package.json manifest");
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
  const manifestLookup = findManifestPath(packageDir);
  const manifest = fs.existsSync(manifestLookup.path) ? readJson(manifestLookup.path) : null;
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

function validateImplementationControlCycle(cyclePath) {
  const errors = [];
  const warnings = [];
  const result = readJson(cyclePath);
  const label = "implementation_control_cycle";

  requireString(result, "schema_version", label, errors);
  requireString(result, "id", label, errors);
  requireString(result, "profile", label, errors);
  requireString(result, "public_safety", label, errors);
  requireJsonArray(result, "cycles", label, errors);
  requireJsonArray(result, "cycle_transitions", label, errors);
  requireArray(result, "kaizen_finding_taxonomy", label, errors);
  requireArray(result, "kaizen_blocking_findings", label, errors);
  requireString(result, "kaizen_default_rule", label, errors);
  requireArray(result, "boundaries", label, errors);
  requireArray(result, "limitations", label, errors);

  if (result.profile !== undefined && result.profile !== "implementation_control") {
    errors.push(`${label}.profile must be implementation_control`);
  }
  if (result.public_safety !== undefined && result.public_safety !== "synthetic_public") {
    errors.push(`${label}.public_safety must be synthetic_public`);
  }

  const requiredCycleIds = new Set([
    "human_projection_feedback",
    "implementation_planning",
    "bounded_work_batch",
    "review_and_evidence",
    "release_or_publish",
    "runtime_feedback",
    "kaizen_improvement"
  ]);
  const requiredTransitionFields = [
    "from",
    "to",
    "trigger",
    "required_outputs",
    "required_gates",
    "handoff_artifact",
    "owner",
    "failure_behavior",
    "recovery_behavior"
  ];
  const requiredTransitions = [
    ["human_projection_feedback", "implementation_planning", "equilibrium_reached"],
    ["human_projection_feedback", "kaizen_improvement", "cycle_completed"],
    ["implementation_planning", "bounded_work_batch", "launch_record_ready"],
    ["implementation_planning", "kaizen_improvement", "cycle_completed"],
    ["bounded_work_batch", "review_and_evidence", "evidence_ready"],
    ["bounded_work_batch", "kaizen_improvement", "cycle_completed"],
    ["review_and_evidence", "release_or_publish", "review_approved"],
    ["review_and_evidence", "human_projection_feedback", "baseline_gap_found"],
    ["review_and_evidence", "kaizen_improvement", "cycle_completed"],
    ["release_or_publish", "runtime_feedback", "released_or_published"],
    ["release_or_publish", "kaizen_improvement", "cycle_completed"],
    ["runtime_feedback", "human_projection_feedback", "graph_or_projection_improvement_required"],
    ["runtime_feedback", "implementation_planning", "implementation_change_required"],
    ["runtime_feedback", "kaizen_improvement", "cycle_completed"],
    ["kaizen_improvement", "human_projection_feedback", "graph_or_projection_improvement_required"],
    ["kaizen_improvement", "implementation_planning", "planning_improvement_required"],
    ["kaizen_improvement", "bounded_work_batch", "implementation_rework_required"],
    ["kaizen_improvement", "runtime_feedback", "runtime_evidence_required"]
  ];
  const requiredKaizenFindings = [
    "artifact_improvement",
    "graph_spec_improvement",
    "process_improvement",
    "validator_improvement",
    "tooling_improvement",
    "dna_alignment_issue",
    "quality_regression",
    "safety_regression",
    "critical_drift",
    "user_value_gap"
  ];
  const requiredBlockingFindings = [
    "safety_regression",
    "quality_regression",
    "dna_alignment_issue",
    "critical_drift"
  ];
  const cycleIds = new Set();
  const forbiddenAutoUpdateTerms = [
    "automatic canonical update",
    "automatically updates canonical",
    "auto canonical update",
    "feedback directly updates",
    "evidence is approval"
  ];

  if (Array.isArray(result.cycles)) {
    for (const [index, cycle] of result.cycles.entries()) {
      const cycleLabel = `${label}.cycles[${index}]`;
      requireString(cycle, "id", cycleLabel, errors);
      requireString(cycle, "purpose", cycleLabel, errors);
      requireArray(cycle, "stages", cycleLabel, errors);
      requireArray(cycle, "inputs", cycleLabel, errors);
      requireArray(cycle, "outputs", cycleLabel, errors);
      requireArray(cycle, "gates", cycleLabel, errors);
      requireArray(cycle, "validators", cycleLabel, errors);
      requireString(cycle, "recovery_behavior", cycleLabel, errors);
      requireString(cycle, "repeat_condition", cycleLabel, errors);
      requireString(cycle, "promotion_path", cycleLabel, errors);
      requireArray(cycle, "evidence_refs", cycleLabel, errors);
      requireArray(cycle, "limitations", cycleLabel, errors);

      if (typeof cycle.id === "string") {
        if (cycleIds.has(cycle.id)) {
          errors.push(`${cycleLabel}.id duplicates ${cycle.id}`);
        }
        cycleIds.add(cycle.id);
      }

      if (Array.isArray(cycle.stages) && cycle.stages.length < 2) {
        errors.push(`${cycleLabel}.stages must contain at least two stages`);
      }
      if (Array.isArray(cycle.gates) && cycle.gates.length === 0) {
        errors.push(`${cycleLabel}.gates must not be empty`);
      }
      if (Array.isArray(cycle.validators) && cycle.validators.length === 0) {
        errors.push(`${cycleLabel}.validators must not be empty`);
      }
      if (Array.isArray(cycle.evidence_refs) && cycle.evidence_refs.length === 0) {
        errors.push(`${cycleLabel}.evidence_refs must not be empty`);
      }

      const cycleText = JSON.stringify(cycle).toLowerCase();
      for (const forbiddenTerm of forbiddenAutoUpdateTerms) {
        if (cycleText.includes(forbiddenTerm)) {
          errors.push(`${cycleLabel} contains forbidden auto-update semantics: ${forbiddenTerm}`);
        }
      }
    }
  }

  for (const requiredCycleId of requiredCycleIds) {
    if (!cycleIds.has(requiredCycleId)) {
      errors.push(`${label}.cycles is missing required cycle ${requiredCycleId}`);
    }
  }

  if (Array.isArray(result.cycle_transitions)) {
    const transitionKeys = new Set();
    for (const [index, transition] of result.cycle_transitions.entries()) {
      const transitionLabel = `${label}.cycle_transitions[${index}]`;

      for (const field of requiredTransitionFields) {
        if (["required_outputs", "required_gates"].includes(field)) {
          requireArray(transition, field, transitionLabel, errors);
          if (Array.isArray(transition[field]) && transition[field].length === 0) {
            errors.push(`${transitionLabel}.${field} must not be empty`);
          }
        } else {
          requireString(transition, field, transitionLabel, errors);
        }
      }

      if (typeof transition.from === "string" && !cycleIds.has(transition.from)) {
        errors.push(`${transitionLabel}.from references unknown cycle ${transition.from}`);
      }
      if (typeof transition.to === "string" && !cycleIds.has(transition.to)) {
        errors.push(`${transitionLabel}.to references unknown cycle ${transition.to}`);
      }

      const transitionKey = `${transition.from ?? "?"}->${transition.to ?? "?"}:${transition.trigger ?? "?"}`;
      if (transitionKeys.has(transitionKey)) {
        errors.push(`${transitionLabel} duplicates transition ${transitionKey}`);
      }
      transitionKeys.add(transitionKey);

      const transitionText = JSON.stringify(transition).toLowerCase();
      for (const forbiddenTerm of forbiddenAutoUpdateTerms) {
        if (transitionText.includes(forbiddenTerm)) {
          errors.push(`${transitionLabel} contains forbidden auto-update semantics: ${forbiddenTerm}`);
        }
      }
    }

    for (const [from, to, trigger] of requiredTransitions) {
      const transitionKey = `${from}->${to}:${trigger}`;
      if (!transitionKeys.has(transitionKey)) {
        errors.push(`${label}.cycle_transitions is missing required transition ${transitionKey}`);
      }
    }

    for (const cycleId of requiredCycleIds) {
      if (cycleId === "kaizen_improvement") {
        continue;
      }
      const transitionKey = `${cycleId}->kaizen_improvement:cycle_completed`;
      if (!transitionKeys.has(transitionKey)) {
        errors.push(`${label}.cycle_transitions must route ${cycleId} to kaizen_improvement on cycle_completed`);
      }
    }
  }

  if (Array.isArray(result.kaizen_finding_taxonomy)) {
    for (const finding of requiredKaizenFindings) {
      if (!result.kaizen_finding_taxonomy.includes(finding)) {
        errors.push(`${label}.kaizen_finding_taxonomy is missing ${finding}`);
      }
    }
  }

  if (Array.isArray(result.kaizen_blocking_findings)) {
    for (const finding of requiredBlockingFindings) {
      if (!result.kaizen_blocking_findings.includes(finding)) {
        errors.push(`${label}.kaizen_blocking_findings is missing ${finding}`);
      }
    }
  }

  const kaizenRule = typeof result.kaizen_default_rule === "string" ? result.kaizen_default_rule.toLowerCase() : "";
  for (const expectedTerm of ["safety", "quality", "dna", "critical drift"]) {
    if (kaizenRule && !kaizenRule.includes(expectedTerm)) {
      warnings.push(`${label}.kaizen_default_rule should mention ${expectedTerm}`);
    }
  }

  if (Array.isArray(result.boundaries)) {
    const boundaryText = result.boundaries.join("\n").toLowerCase();
    const requiredBoundaries = [
      "generated",
      "evidence",
      "feedback",
      "proposal",
      "ready"
    ];
    for (const requiredBoundary of requiredBoundaries) {
      if (!boundaryText.includes(requiredBoundary)) {
        warnings.push(`${label}.boundaries should mention ${requiredBoundary}`);
      }
    }
  }

  return { errors, warnings };
}

function validatePublicImplementationControlResult(resultPath, mode) {
  const errors = [];
  const warnings = [];
  const result = readJson(resultPath);
  const label = mode.replace(/-/g, "_");

  requireString(result, "schema_version", label, errors);
  requireString(result, "id", label, errors);
  requireString(result, "profile", label, errors);
  requireString(result, "public_safety", label, errors);
  requireArray(result, "evidence_refs", label, errors);
  requireArray(result, "limitations", label, errors);

  if (result.profile !== undefined && result.profile !== "implementation_control") {
    errors.push(`${label}.profile must be implementation_control`);
  }
  if (result.public_safety !== undefined && result.public_safety !== "synthetic_public") {
    errors.push(`${label}.public_safety must be synthetic_public`);
  }

  const resultText = JSON.stringify(result).toLowerCase();
  const forbiddenTerms = [
    "/users/rim/documents/" + "github/",
    "lar" + "ena",
    "simai private",
    "source/" + "workflow",
    "private runtime " + "trace",
    "automatic canonical update",
    "feedback directly updates",
    "evidence is approval"
  ];
  for (const forbiddenTerm of forbiddenTerms) {
    if (resultText.includes(forbiddenTerm)) {
      errors.push(`${label} contains forbidden public-transfer term: ${forbiddenTerm}`);
    }
  }

  if (mode === "graph-dna-alignment") {
    requireObject(result, "parent_dna", label, errors);
    requireObject(result, "component_dna", label, errors);
    requireObject(result, "alignment", label, errors);
    if (result.parent_dna && typeof result.parent_dna === "object") {
      requireString(result.parent_dna, "mission", `${label}.parent_dna`, errors);
      requireString(result.parent_dna, "evolution_vector", `${label}.parent_dna`, errors);
      requireArray(result.parent_dna, "non_negotiable_principles", `${label}.parent_dna`, errors);
    }
    if (result.component_dna && typeof result.component_dna === "object") {
      requireArray(result.component_dna, "owns", `${label}.component_dna`, errors);
      requireArray(result.component_dna, "must_not_own", `${label}.component_dna`, errors);
      requireArray(result.component_dna, "invariants", `${label}.component_dna`, errors);
      requireArray(result.component_dna, "success_criteria", `${label}.component_dna`, errors);
      requireArray(result.component_dna, "anti_patterns", `${label}.component_dna`, errors);
    }
    if (result.alignment && typeof result.alignment === "object" && typeof result.alignment.proposal_required !== "boolean") {
      errors.push(`${label}.alignment.proposal_required must be a boolean`);
    }
  }

  if (mode === "work-state-machine") {
    requireArray(result, "states", label, errors);
    requireJsonArray(result, "transitions", label, errors);
    requireArray(result, "false_transition_guards", label, errors);
    const stateText = Array.isArray(result.states) ? result.states.join("\n") : "";
    for (const requiredState of ["planned", "ready_to_execute", "evidence_recorded", "sync_proposed", "approved"]) {
      if (!stateText.includes(requiredState)) {
        errors.push(`${label}.states must include ${requiredState}`);
      }
    }
    const guardText = Array.isArray(result.false_transition_guards) ? result.false_transition_guards.join("\n").toLowerCase() : "";
    for (const requiredGuard of ["ready", "written", "sync"]) {
      if (!guardText.includes(requiredGuard)) {
        warnings.push(`${label}.false_transition_guards should mention ${requiredGuard}`);
      }
    }
  }

  if (mode === "launch-record") {
    for (const field of [
      "workflow_id",
      "process_model_id",
      "cycle_id",
      "current_state",
      "target_state",
      "owner_role"
    ]) {
      requireString(result, field, label, errors);
    }
    for (const field of [
      "allowed_files",
      "forbidden_files",
      "allowed_actions",
      "required_gates",
      "required_evidence",
      "stop_conditions"
    ]) {
      requireArray(result, field, label, errors);
    }
    if (typeof result.approved_by_user !== "boolean") {
      errors.push(`${label}.approved_by_user must be a boolean`);
    }
    const launchText = JSON.stringify(result).toLowerCase();
    for (const requiredBoundary of ["not execution", "not implementation", "not approval", "not release"]) {
      if (!launchText.includes(requiredBoundary)) {
        warnings.push(`${label}.limitations should mention ${requiredBoundary}`);
      }
    }
  }

  if (mode === "process-control-contract") {
    for (const field of ["process_id", "cycle_id", "state_machine_id", "recovery_behavior"]) {
      requireString(result, field, label, errors);
    }
    requireObject(result, "launch_record_policy", label, errors);
    requireObject(result, "kaizen_policy", label, errors);
    requireArray(result, "evidence_requirements", label, errors);
    requireArray(result, "risk_controls", label, errors);
    requireArray(result, "validators", label, errors);

    if (result.launch_record_policy && typeof result.launch_record_policy === "object") {
      requireArray(result.launch_record_policy, "required_for_states", `${label}.launch_record_policy`, errors);
      requireArray(result.launch_record_policy, "required_for_transitions", `${label}.launch_record_policy`, errors);
      if (typeof result.launch_record_policy.approval_required !== "boolean") {
        errors.push(`${label}.launch_record_policy.approval_required must be a boolean`);
      }
    }

    if (result.kaizen_policy && typeof result.kaizen_policy === "object") {
      if (result.kaizen_policy.terminal_state_requires_review_or_skip !== true) {
        errors.push(`${label}.kaizen_policy.terminal_state_requires_review_or_skip must be true`);
      }
      requireString(result.kaizen_policy, "accepted_skip_field", `${label}.kaizen_policy`, errors);
    }

    if (result.technology_quality_feedback_policy !== undefined) {
      requireObject(result, "technology_quality_feedback_policy", label, errors);
      if (result.technology_quality_feedback_policy && typeof result.technology_quality_feedback_policy === "object") {
        requireArray(result.technology_quality_feedback_policy, "required_for_transitions", `${label}.technology_quality_feedback_policy`, errors);
        requireArray(result.technology_quality_feedback_policy, "accepted_verdicts", `${label}.technology_quality_feedback_policy`, errors);
        if (result.technology_quality_feedback_policy.blocking_findings_stop_transition !== true) {
          errors.push(`${label}.technology_quality_feedback_policy.blocking_findings_stop_transition must be true`);
        }
      }
    }

    const validatorText = Array.isArray(result.validators) ? result.validators.join("\n") : "";
    for (const requiredValidator of ["launch-record", "process-transition"]) {
      if (!validatorText.includes(requiredValidator)) {
        errors.push(`${label}.validators must include ${requiredValidator}`);
      }
    }
    if (
      result.technology_quality_feedback_policy !== undefined &&
      !validatorText.includes("technology-quality-feedback")
    ) {
      errors.push(`${label}.validators must include technology-quality-feedback when technology_quality_feedback_policy is present`);
    }
  }

  if (mode === "technology-quality-feedback") {
    const classifications = new Set([
      "accepted",
      "work_fix_required",
      "test_gap",
      "spec_gap",
      "graph_update_proposal",
      "process_improvement",
      "release_blocker",
      "security_blocker",
      "defer_with_reason"
    ]);
    const verdicts = new Set([
      "accepted",
      "accepted_with_deferred_items",
      "changes_requested",
      "blocked_by_spec_gap",
      "blocked_by_security",
      "blocked_by_missing_evidence",
      "release_not_ready"
    ]);
    const severities = new Set(["critical", "high", "medium", "low"]);
    const acceptedVerdicts = new Set(["accepted", "accepted_with_deferred_items"]);

    for (const field of ["technology_ref", "process_id", "launch_record_ref", "verdict", "next_transition"]) {
      requireString(result, field, label, errors);
    }
    for (const field of [
      "work_evidence_refs",
      "required_steps",
      "completed_steps",
      "missing_steps",
      "review_dimensions",
      "feedback_classification",
      "blocking_findings",
      "kaizen_refs"
    ]) {
      requireArray(result, field, label, errors);
    }
    requireJsonArray(result, "findings", label, errors);

    if (typeof result.verdict === "string" && !verdicts.has(result.verdict)) {
      errors.push(`${label}.verdict has unsupported value ${result.verdict}`);
    }

    const completedSteps = new Set(Array.isArray(result.completed_steps) ? result.completed_steps : []);
    if (Array.isArray(result.required_steps)) {
      for (const requiredStep of result.required_steps) {
        if (!completedSteps.has(requiredStep)) {
          errors.push(`${label}.completed_steps is missing required step ${requiredStep}`);
        }
      }
    }
    if (Array.isArray(result.missing_steps) && result.missing_steps.length > 0) {
      errors.push(`${label}.missing_steps must be empty for a passing feedback report`);
    }

    const feedbackClassifications = new Set(Array.isArray(result.feedback_classification) ? result.feedback_classification : []);
    if (Array.isArray(result.feedback_classification)) {
      for (const classification of result.feedback_classification) {
        if (!classifications.has(classification)) {
          errors.push(`${label}.feedback_classification has unsupported value ${classification}`);
        }
      }
    }

    const blockingFindingRefs = new Set(Array.isArray(result.blocking_findings) ? result.blocking_findings : []);
    let hasBlockingFinding = false;
    let hasProcessImprovement = false;
    let hasSpecGap = false;

    if (Array.isArray(result.findings)) {
      for (const [index, finding] of result.findings.entries()) {
        const findingLabel = `${label}.findings[${index}]`;
        for (const field of ["id", "dimension", "classification", "severity", "summary", "next_route"]) {
          requireString(finding, field, findingLabel, errors);
        }
        requireArray(finding, "evidence_refs", findingLabel, errors);
        if (typeof finding.blocking !== "boolean") {
          errors.push(`${findingLabel}.blocking must be a boolean`);
        }

        if (typeof finding.classification === "string") {
          if (!classifications.has(finding.classification)) {
            errors.push(`${findingLabel}.classification has unsupported value ${finding.classification}`);
          }
          if (!feedbackClassifications.has(finding.classification)) {
            errors.push(`${label}.feedback_classification must include finding classification ${finding.classification}`);
          }
          if (finding.classification === "process_improvement") {
            hasProcessImprovement = true;
            if (typeof finding.next_route !== "string" || !finding.next_route.toLowerCase().includes("kaizen")) {
              errors.push(`${findingLabel}.next_route must route process_improvement to Kaizen`);
            }
          }
          if (finding.classification === "spec_gap") {
            hasSpecGap = true;
            const route = typeof finding.next_route === "string" ? finding.next_route.toLowerCase() : "";
            if (!route.includes("planning") && !route.includes("human_projection") && !route.includes("graph_sync")) {
              errors.push(`${findingLabel}.next_route must route spec_gap to planning, human_projection or graph_sync`);
            }
          }
          if (["release_blocker", "security_blocker"].includes(finding.classification) && finding.blocking !== true) {
            errors.push(`${findingLabel}.blocking must be true for ${finding.classification}`);
          }
        }

        if (finding.blocking === true) {
          hasBlockingFinding = true;
          if (typeof finding.id === "string" && !blockingFindingRefs.has(finding.id)) {
            errors.push(`${label}.blocking_findings must include blocking finding ${finding.id}`);
          }
        }

        if (typeof finding.severity === "string" && !severities.has(finding.severity)) {
          errors.push(`${findingLabel}.severity has unsupported value ${finding.severity}`);
        }
      }
    }

    if (hasProcessImprovement && (!Array.isArray(result.kaizen_refs) || result.kaizen_refs.length === 0)) {
      errors.push(`${label}.kaizen_refs must not be empty when process_improvement is present`);
    }

    if (hasSpecGap && typeof result.next_transition === "string") {
      const transition = result.next_transition.toLowerCase();
      if (!transition.includes("planning") && !transition.includes("human_projection") && !transition.includes("graph_sync")) {
        errors.push(`${label}.next_transition must route spec_gap to planning, human_projection or graph_sync`);
      }
    }

    if (acceptedVerdicts.has(result.verdict) && (hasBlockingFinding || blockingFindingRefs.size > 0)) {
      errors.push(`${label}.verdict cannot be accepted while blocking findings are present`);
    }

    const feedbackText = JSON.stringify(result).toLowerCase();
    const forbiddenBoundaryTerms = [
      "evidence is approval",
      "tests are acceptance",
      "feedback directly updates",
      "automatic canonical update",
      "automatically updates canonical",
      "proposal is controlled update",
      "canonical_update"
    ];
    for (const forbiddenTerm of forbiddenBoundaryTerms) {
      if (feedbackText.includes(forbiddenTerm)) {
        errors.push(`${label} contains forbidden authorization boundary term: ${forbiddenTerm}`);
      }
    }

    const limitationText = Array.isArray(result.limitations) ? result.limitations.join("\n").toLowerCase() : "";
    for (const expectedBoundary of ["tests", "evidence", "canonical", "acceptance"]) {
      if (!limitationText.includes(expectedBoundary)) {
        warnings.push(`${label}.limitations should mention ${expectedBoundary}`);
      }
    }
  }

  if (mode === "recovery-resume-record") {
    for (const field of [
      "current_state",
      "last_good_checkpoint",
      "target_scope",
      "last_validation_result",
      "evidence_status",
      "next_safe_command",
      "rollback_option"
    ]) {
      requireString(result, field, label, errors);
    }
    requireArray(result, "blockers", label, errors);
    if (typeof result.human_confirmation_required !== "boolean") {
      errors.push(`${label}.human_confirmation_required must be a boolean`);
    }
  }

  if (mode === "risk-control-matrix") {
    requireJsonArray(result, "risks", label, errors);
    const severities = new Set(["critical", "high", "medium", "low"]);
    if (Array.isArray(result.risks)) {
      for (const [index, risk] of result.risks.entries()) {
        const riskLabel = `${label}.risks[${index}]`;
        for (const field of [
          "id",
          "severity",
          "description",
          "detection_signal",
          "prevention",
          "gate_or_validator",
          "evidence_requirement",
          "recovery_action",
          "escalation_rule",
          "owner_role"
        ]) {
          requireString(risk, field, riskLabel, errors);
        }
        if (typeof risk.severity === "string" && !severities.has(risk.severity)) {
          errors.push(`${riskLabel}.severity has unsupported value ${risk.severity}`);
        }
      }
    }
  }

  if (mode === "multi-agent-coordination") {
    requireArray(result, "roles", label, errors);
    requireJsonArray(result, "reservations", label, errors);
    requireArray(result, "locking_rules", label, errors);
    requireString(result, "conflict_resolution", label, errors);
    if (Array.isArray(result.reservations)) {
      for (const [index, reservation] of result.reservations.entries()) {
        const reservationLabel = `${label}.reservations[${index}]`;
        for (const field of ["id", "owner_role", "scope", "evidence_path", "proposal_path"]) {
          requireString(reservation, field, reservationLabel, errors);
        }
        requireArray(reservation, "allowed_actions", reservationLabel, errors);
      }
    }
  }

  if (mode === "source-boundary-contract") {
    requireJsonArray(result, "source_roles", label, errors);
    requireString(result, "promotion_rule", label, errors);
    requireArray(result, "rejected_promotion_targets", label, errors);
    const roles = new Set();
    if (Array.isArray(result.source_roles)) {
      for (const [index, role] of result.source_roles.entries()) {
        const roleLabel = `${label}.source_roles[${index}]`;
        requireString(role, "role", roleLabel, errors);
        requireString(role, "description", roleLabel, errors);
        if (typeof role.canonical_write_allowed !== "boolean") {
          errors.push(`${roleLabel}.canonical_write_allowed must be a boolean`);
        }
        if (typeof role.role === "string") {
          roles.add(role.role);
        }
      }
    }
    for (const requiredRole of ["canonical", "generated", "curated_human", "workflow", "local_scratch"]) {
      if (!roles.has(requiredRole)) {
        errors.push(`${label}.source_roles must include ${requiredRole}`);
      }
    }
    if (typeof result.promotion_rule === "string" && !result.promotion_rule.toLowerCase().includes("proposal")) {
      errors.push(`${label}.promotion_rule must require proposal-based promotion`);
    }
  }

  return { errors, warnings };
}

function validateProcessTransition(stateMachinePath, transitionRequestPath) {
  const errors = [];
  const warnings = [];
  const stateMachine = readJson(stateMachinePath);
  const request = readJson(transitionRequestPath);
  const label = "process_transition";

  requireString(stateMachine, "schema_version", "state_machine", errors);
  requireString(stateMachine, "id", "state_machine", errors);
  requireString(stateMachine, "profile", "state_machine", errors);
  requireString(stateMachine, "public_safety", "state_machine", errors);
  requireArray(stateMachine, "states", "state_machine", errors);
  requireJsonArray(stateMachine, "transitions", "state_machine", errors);
  requireArray(stateMachine, "false_transition_guards", "state_machine", errors);

  requireString(request, "schema_version", label, errors);
  requireString(request, "id", label, errors);
  requireString(request, "profile", label, errors);
  requireString(request, "public_safety", label, errors);
  requireString(request, "process_id", label, errors);
  requireString(request, "current_state", label, errors);
  requireString(request, "target_state", label, errors);
  requireArray(request, "evidence_refs", label, errors);
  for (const optionalStringField of ["launch_record_ref", "kaizen_review_ref", "no_reusable_lessons_reason"]) {
    if (typeof request[optionalStringField] !== "string") {
      errors.push(`${label}.${optionalStringField} must be a string`);
    }
  }
  requireArray(request, "limitations", label, errors);

  if (stateMachine.profile !== undefined && stateMachine.profile !== "implementation_control") {
    errors.push("state_machine.profile must be implementation_control");
  }
  if (stateMachine.public_safety !== undefined && stateMachine.public_safety !== "synthetic_public") {
    errors.push("state_machine.public_safety must be synthetic_public");
  }
  if (request.profile !== undefined && request.profile !== "implementation_control") {
    errors.push(`${label}.profile must be implementation_control`);
  }
  if (request.public_safety !== undefined && request.public_safety !== "synthetic_public") {
    errors.push(`${label}.public_safety must be synthetic_public`);
  }

  const states = new Set(Array.isArray(stateMachine.states) ? stateMachine.states : []);
  if (request.current_state && !states.has(request.current_state)) {
    errors.push(`${label}.current_state references unknown state ${request.current_state}`);
  }
  if (request.target_state && !states.has(request.target_state)) {
    errors.push(`${label}.target_state references unknown state ${request.target_state}`);
  }

  const transitions = Array.isArray(stateMachine.transitions) ? stateMachine.transitions : [];
  const transition = transitions.find((item) => (
    item.from === request.current_state && item.to === request.target_state
  ));
  const requiredEvidence = transition && Array.isArray(transition.requires_evidence)
    ? transition.requires_evidence
    : [];
  const providedEvidence = Array.isArray(request.evidence_refs) ? request.evidence_refs : [];
  const missingEvidence = requiredEvidence.filter((requiredEvidenceRef) => (
    !providedEvidence.includes(requiredEvidenceRef)
  ));
  const terminalStates = new Set(Array.isArray(stateMachine.terminal_states) ? stateMachine.terminal_states : []);
  const terminalRequiresKaizen = transition && transition.terminal_requires_kaizen === true;
  const terminalTransition = terminalStates.has(request.target_state) || terminalRequiresKaizen === true;
  const launchRecordSatisfied = !(transition && transition.requires_launch_record === true) || Boolean(request.launch_record_ref);
  const kaizenSatisfied = !terminalTransition || Boolean(request.kaizen_review_ref) || Boolean(request.no_reusable_lessons_reason);
  const explanation = {
    process_id: typeof request.process_id === "string" ? request.process_id : "",
    current_state: typeof request.current_state === "string" ? request.current_state : "",
    target_state: typeof request.target_state === "string" ? request.target_state : "",
    matched_transition: Boolean(transition),
    matched_transition_ref: transition ? `${transition.from}->${transition.to}` : "",
    required_evidence: requiredEvidence,
    provided_evidence: providedEvidence,
    missing_evidence: missingEvidence,
    requires_launch_record: Boolean(transition && transition.requires_launch_record === true),
    launch_record_ref: typeof request.launch_record_ref === "string" ? request.launch_record_ref : "",
    launch_record_satisfied: launchRecordSatisfied,
    terminal_transition: terminalTransition,
    terminal_requires_kaizen: Boolean(terminalRequiresKaizen),
    kaizen_decision: {
      status: kaizenSatisfied ? (terminalTransition ? "satisfied" : "not_required") : "missing",
      kaizen_review_ref: typeof request.kaizen_review_ref === "string" ? request.kaizen_review_ref : "",
      no_reusable_lessons_reason: typeof request.no_reusable_lessons_reason === "string" ? request.no_reusable_lessons_reason : ""
    },
    false_transition_guard_summary: Array.isArray(stateMachine.false_transition_guards)
      ? stateMachine.false_transition_guards
      : []
  };
  if (!transition) {
    errors.push(`${label} transition ${request.current_state}->${request.target_state} is not allowed`);
  }

  const evidence = new Set(Array.isArray(request.evidence_refs) ? request.evidence_refs : []);
  if (transition) {
    for (const requiredEvidenceRef of requiredEvidence) {
      if (!evidence.has(requiredEvidenceRef)) {
        errors.push(`${label} missing required evidence ${requiredEvidenceRef}`);
      }
    }
  }

  if (transition && transition.requires_launch_record === true && !request.launch_record_ref) {
    errors.push(`${label} requires launch_record_ref for ${request.current_state}->${request.target_state}`);
  }

  if ((terminalStates.has(request.target_state) || terminalRequiresKaizen) && !request.kaizen_review_ref && !request.no_reusable_lessons_reason) {
    errors.push(`${label} terminal transition requires kaizen_review_ref or no_reusable_lessons_reason`);
  }

  const guardText = Array.isArray(stateMachine.false_transition_guards) ? stateMachine.false_transition_guards.join("\n").toLowerCase() : "";
  for (const requiredGuard of ["ready", "tests", "sync", "released", "terminal"]) {
    if (!guardText.includes(requiredGuard)) {
      warnings.push(`state_machine.false_transition_guards should mention ${requiredGuard}`);
    }
  }

  return { errors, warnings, explanation };
}

const rawArgs = process.argv.slice(2);
const outputFormat = rawArgs.includes("--markdown") ? "markdown" : "json";
const positionalArgs = rawArgs.filter((arg) => arg !== "--markdown" && arg !== "--json");
const modeOrPackageDir = positionalArgs[0];
if (!modeOrPackageDir) {
  usage();
  process.exit(2);
}

try {
  const isSeedMode = modeOrPackageDir === "seed";
  const isProfileMode = modeOrPackageDir === "profile";
  const isContextPackMode = modeOrPackageDir === "context-pack";
  const isImplementationControlCycleMode = modeOrPackageDir === "implementation-control-cycle";
  const isProcessTransitionMode = modeOrPackageDir === "process-transition";
  const publicResultModes = new Set([
    "launch-record",
    "process-control-contract",
    "technology-quality-feedback",
    "graph-dna-alignment",
    "work-state-machine",
    "recovery-resume-record",
    "risk-control-matrix",
    "multi-agent-coordination",
    "source-boundary-contract"
  ]);
  const isPublicResultMode = publicResultModes.has(modeOrPackageDir);
  const targetPath = isSeedMode || isProfileMode || isContextPackMode || isImplementationControlCycleMode || isProcessTransitionMode || isPublicResultMode ? positionalArgs[1] : modeOrPackageDir;
  const contextPackPath = isContextPackMode ? positionalArgs[2] : null;
  const transitionRequestPath = isProcessTransitionMode ? positionalArgs[2] : null;
  if (!targetPath) {
    usage();
    process.exit(2);
  }
  if (isContextPackMode && !contextPackPath) {
    usage();
    process.exit(2);
  }
  if (isProcessTransitionMode && !transitionRequestPath) {
    usage();
    process.exit(2);
  }
  const result = isSeedMode
    ? validateSeed(path.resolve(targetPath))
    : isProfileMode
      ? validateProfile(path.resolve(targetPath))
      : isContextPackMode
        ? validateContextPack(path.resolve(targetPath), path.resolve(contextPackPath))
        : isImplementationControlCycleMode
          ? validateImplementationControlCycle(path.resolve(targetPath))
          : isProcessTransitionMode
            ? validateProcessTransition(path.resolve(targetPath), path.resolve(transitionRequestPath))
            : isPublicResultMode
              ? validatePublicImplementationControlResult(path.resolve(targetPath), modeOrPackageDir)
              : validatePackage(path.resolve(targetPath));
  const output = {
    mode: isSeedMode ? "seed" : isProfileMode ? "profile" : isContextPackMode ? "context_pack" : isImplementationControlCycleMode ? "implementation_control_cycle" : isProcessTransitionMode ? "process_transition" : isPublicResultMode ? modeOrPackageDir.replace(/-/g, "_") : "package",
    target: isContextPackMode ? path.resolve(contextPackPath) : isProcessTransitionMode ? path.resolve(transitionRequestPath) : path.resolve(targetPath),
    package: isContextPackMode ? path.resolve(targetPath) : undefined,
    state_machine: isProcessTransitionMode ? path.resolve(targetPath) : undefined,
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
    explanation: result.explanation
  };
  if (outputFormat === "markdown") {
    console.log(formatMarkdownReport(output));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
  process.exit(output.valid ? 0 : 1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
