const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SCHEMA_ID = "https://mirai-graph.dev/schemas/graph-manifest.schema.json";
const LEGACY_WORKSPACE_SCHEMA = "https://schemas.simai.io/mirai-graph/graph.schema.json";
const SCHEMA_VERSION = "2.0.0";
const FORMAT = "mirai-graph";
const MANIFEST_PATHS = ["graph.json", "graph/graph.json", "mirai-graph-package.json"];
const SCOPES = new Set(["skill", "repository", "workspace", "domain", "federation", "package"]);
const CONFORMANCE = new Set(["level_0", "level_1", "level_2", "level_3", "level_4"]);

const ROOT_V1_FIELDS = new Set(["$schema", "format", "schema_version", "workspace_id", "id", "scope", "title", "owner", "local", "imports"]);
const INNER_V1_FIELDS = new Set(["schema_version", "schemaVersion", "graph_id", "graphId", "legacyGraphIds", "title", "description", "graph_type", "type", "kind", "status", "owner", "ownerSkill", "domainOwnerSkills", "companionSkills", "profiles", "source_of_truth", "sourceOfTruth", "canonical_projection", "dna_path", "schemas_path", "generated_path", "source_path", "graph_runtime", "graphRuntime", "runtime_context", "management_profile", "federation", "evolution", "graph_kernel", "hybrid_sot", "source_boundary", "sourceBoundaries", "sourceInventory", "workflowIntegration", "objectIndexes", "relationIndexes", "generatedContextPacks", "generatedReports", "coverageReports", "readinessReports", "public_safety", "entrypoints", "skill", "spec", "spec_index", "entrypoint", "display_name", "model", "nodes", "edges"]);
const PACKAGE_V1_FIELDS = new Set(["schema_version", "schemaVersion", "id", "graph_id", "packageId", "legacyPackageId", "name", "title", "version", "profile", "profiles", "conformance_level", "graph", "description", "license", "public_safety", "nonclaims", "owner", "ownerSkill", "domainOwnerSkill", "hybridSot", "graphOnlyRuntimeAllowed", "createdAt", "status", "gates", "results"]);
const V2_FIELDS = new Set(["$schema", "format", "schema_version", "id", "aliases", "title", "scope", "kind", "owner", "profiles", "graph", "imports", "version", "conformance_level", "public_safety", "nonclaims", "federation", "runtime", "evolution", "extensions", "description", "license"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function graphDataFingerprint(root) {
  const digest = crypto.createHash("sha256");
  let fileCount = 0;
  let byteCount = 0;
  const graphRoot = path.join(root, "graph");
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        if (relative === "graph/graph.json") continue;
        const data = fs.readFileSync(absolute);
        digest.update(relative); digest.update("\0"); digest.update(data); digest.update("\0");
        fileCount += 1; byteCount += data.length;
      }
    }
  }
  visit(graphRoot);
  return { file_count: fileCount, byte_count: byteCount, sha256: `sha256:${digest.digest("hex")}` };
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort();
}

function relativePath(value) {
  if (typeof value !== "string" || value.trim() === "" || path.isAbsolute(value)) return false;
  return !value.split(/[\\/]+/).includes("..");
}

function detectManifestSources(repo) {
  const sources = [];
  for (const relative of MANIFEST_PATHS) {
    const absolute = path.join(repo, relative);
    if (!fs.existsSync(absolute)) continue;
    const payload = readJson(absolute);
    let format = "unknown";
    if (relative === "graph.json" && payload.format === FORMAT && payload.schema_version === SCHEMA_VERSION) format = "root_v2";
    else if (relative === "graph.json" && (payload.format === FORMAT || payload.$schema === LEGACY_WORKSPACE_SCHEMA)) format = "root_v1";
    else if (relative === "graph/graph.json") format = "inner_v1";
    else if (relative === "mirai-graph-package.json") format = "package_v1";
    sources.push({ relative, absolute, format, payload, hash: sha256(fs.readFileSync(absolute)) });
  }
  return sources;
}

function unknownFields(source) {
  const allowed = source.format === "root_v1" ? ROOT_V1_FIELDS : source.format === "inner_v1" ? INNER_V1_FIELDS : source.format === "package_v1" ? PACKAGE_V1_FIELDS : null;
  return allowed ? Object.keys(source.payload).filter((key) => !allowed.has(key)).sort() : [];
}

function asPaths(value) {
  if (Array.isArray(value)) return sortedUnique(value);
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function normalizeImports(value) {
  return (Array.isArray(value) ? value : []).map((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return source;
    const item = { ...source };
    if (Array.isArray(item.raw_source_fallback)) {
      const portable = item.raw_source_fallback.filter(relativePath);
      const nonportable = item.raw_source_fallback.filter((entry) => typeof entry === "string" && !relativePath(entry));
      item.raw_source_fallback = portable;
      if (nonportable.length) {
        item.extensions = { ...(item.extensions || {}), "simai.legacy": { nonportable_raw_source_fallback: nonportable } };
      }
    }
    return item;
  });
}

function validateManifest(manifest, repo = null) {
  const errors = [];
  for (const field of Object.keys(manifest || {})) {
    if (!V2_FIELDS.has(field)) errors.push(`unknown v2 field ${field}`);
  }
  const requiredStrings = ["$schema", "format", "schema_version", "id", "title", "scope", "kind", "owner"];
  for (const field of requiredStrings) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) errors.push(`${field} must be a non-empty string`);
  }
  if (manifest.$schema !== SCHEMA_ID) errors.push(`$schema must equal ${SCHEMA_ID}`);
  if (manifest.format !== FORMAT) errors.push(`format must equal ${FORMAT}`);
  if (manifest.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must equal ${SCHEMA_VERSION}`);
  if (!SCOPES.has(manifest.scope)) errors.push(`unsupported scope ${manifest.scope}`);
  for (const field of ["aliases", "profiles", "imports"]) {
    if (!Array.isArray(manifest[field])) errors.push(`${field} must be an array`);
  }
  if (Array.isArray(manifest.aliases) && new Set(manifest.aliases).size !== manifest.aliases.length) errors.push("aliases must be unique");
  if (Array.isArray(manifest.profiles) && new Set(manifest.profiles).size !== manifest.profiles.length) errors.push("profiles must be unique");
  const technology = manifest?.extensions?.["mirai.project_technology"];
  if (technology !== undefined) {
    if (!technology || typeof technology !== "object" || Array.isArray(technology)) errors.push("extensions.mirai.project_technology must be an object");
    else {
      const expected = {
        contract_version: "1.0.0", context_policy: "task_scoped", source_boundary: "hybrid_sot",
      };
      for (const field of Object.keys(expected)) if (technology[field] !== expected[field]) errors.push(`extensions.mirai.project_technology.${field} is invalid`);
      if (typeof technology.enabled !== "boolean") errors.push("extensions.mirai.project_technology.enabled is invalid");
      if (technology.continuity_policy !== undefined && technology.continuity_policy !== "task_boundary") errors.push("extensions.mirai.project_technology.continuity_policy is invalid");
      for (const field of Object.keys(technology)) if (!(field in expected) && !["enabled", "continuity_policy"].includes(field)) errors.push(`extensions.mirai.project_technology has unknown field ${field}`);
    }
  }
  const programExtension = manifest?.extensions?.["mirai.program"];
  if (programExtension !== undefined) {
    if (!programExtension || typeof programExtension !== "object" || Array.isArray(programExtension)) {
      errors.push("extensions.mirai.program must be an object");
    } else {
      const fields = new Set(["contract_version", "programs", "default_program", "canonical_write_allowed"]);
      for (const field of Object.keys(programExtension)) if (!fields.has(field)) errors.push(`extensions.mirai.program has unknown field ${field}`);
      if (programExtension.contract_version !== "1.0.0") errors.push("extensions.mirai.program.contract_version is invalid");
      if (!Array.isArray(programExtension.programs) || programExtension.programs.length === 0) {
        errors.push("extensions.mirai.program.programs must be a non-empty array");
      } else {
        const ids = new Set();
        for (const [index, item] of programExtension.programs.entries()) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            errors.push(`extensions.mirai.program.programs[${index}] must be an object`);
            continue;
          }
          const itemFields = new Set(["id", "source", "compiled", "digest"]);
          for (const field of Object.keys(item)) if (!itemFields.has(field)) errors.push(`extensions.mirai.program.programs[${index}] has unknown field ${field}`);
          if (typeof item.id !== "string" || !item.id.trim()) errors.push(`extensions.mirai.program.programs[${index}].id is invalid`);
          else if (ids.has(item.id)) errors.push(`extensions.mirai.program duplicate id ${item.id}`);
          else ids.add(item.id);
          if (!relativePath(item.source)) errors.push(`extensions.mirai.program.programs[${index}].source is unsafe`);
          if (item.compiled !== undefined && !relativePath(item.compiled)) errors.push(`extensions.mirai.program.programs[${index}].compiled is unsafe`);
          if (item.digest !== undefined && !/^sha256:[a-f0-9]{64}$/.test(item.digest)) errors.push(`extensions.mirai.program.programs[${index}].digest is invalid`);
        }
        if (programExtension.default_program !== undefined && !ids.has(programExtension.default_program)) errors.push("extensions.mirai.program.default_program is unknown");
      }
      if (programExtension.canonical_write_allowed !== undefined && programExtension.canonical_write_allowed !== false) errors.push("extensions.mirai.program.canonical_write_allowed must be false");
    }
  }
  if (manifest.graph !== null) {
    if (!manifest.graph || typeof manifest.graph !== "object" || Array.isArray(manifest.graph)) {
      errors.push("graph must be an object or null");
    } else {
      if (!relativePath(manifest.graph.root)) errors.push("graph.root must be a safe relative path");
      for (const field of ["source_of_truth", "objects", "relations", "schemas", "generated", "raw_sources"]) {
        if (!Array.isArray(manifest.graph[field])) errors.push(`graph.${field} must be an array`);
        else for (const value of manifest.graph[field]) if (!relativePath(value)) errors.push(`graph.${field} contains unsafe path ${value}`);
      }
    }
  }
  const aliases = new Set();
  for (const [index, item] of (Array.isArray(manifest.imports) ? manifest.imports : []).entries()) {
    if (!item || typeof item !== "object") { errors.push(`imports[${index}] must be an object`); continue; }
    if (typeof item.alias !== "string" || !item.alias.trim()) errors.push(`imports[${index}].alias must be a non-empty string`);
    else if (aliases.has(item.alias)) errors.push(`duplicate import alias ${item.alias}`);
    else aliases.add(item.alias);
    if (typeof item.graph_id !== "string" || !item.graph_id.trim()) errors.push(`imports[${index}].graph_id must be a non-empty string`);
    if (!item.source || !["registry", "git", "file"].includes(item.source.type)) errors.push(`imports[${index}].source.type is invalid`);
  }
  if (manifest.scope === "package") {
    if (typeof manifest.version !== "string" || !manifest.version.trim()) errors.push("package scope requires version");
    if (!CONFORMANCE.has(manifest.conformance_level)) errors.push("package scope requires a supported conformance_level");
    if (!manifest.graph || !manifest.graph.objects.length || !manifest.graph.relations.length) errors.push("package scope requires graph object and relation entrypoints");
  }
  if (repo && manifest.graph) {
    for (const field of ["objects", "relations"]) {
      for (const item of manifest.graph[field]) if (!fs.existsSync(path.join(repo, item))) errors.push(`missing graph.${field} entrypoint ${item}`);
    }
  }
  return errors;
}

function migratePlan(repo, options = {}) {
  const root = path.resolve(repo);
  const sources = detectManifestSources(root);
  const current = sources.find((source) => source.format === "root_v2");
  if (current) {
    const errors = validateManifest(current.payload, root);
    return {
      status: errors.length ? "fail" : "success",
      manifest_status: errors.length ? "conflict" : "current",
      source_formats: sources.map((item) => item.format),
      target_schema_version: SCHEMA_VERSION,
      migration_required: false,
      identity_map: { canonical: current.payload.id, aliases: current.payload.aliases || [] },
      conflicts: errors,
      can_execute_now: errors.length === 0,
      operation_mode: "read_only",
      next_action: errors.length ? "repair the v2 manifest" : "none",
      manifest: current.payload,
      source_hashes: Object.fromEntries(sources.map((item) => [item.relative, item.hash]))
    };
  }
  const known = sources.filter((source) => source.format !== "unknown");
  const conflicts = [];
  if (!known.length) conflicts.push("manifest_missing");
  for (const source of known) {
    const unknown = unknownFields(source);
    if (unknown.length) conflicts.push(`review_required:${source.relative}:${unknown.join(",")}`);
  }
  const rootV1 = known.find((source) => source.format === "root_v1")?.payload;
  const inner = known.find((source) => source.format === "inner_v1")?.payload;
  const pkg = known.find((source) => source.format === "package_v1")?.payload;
  const localIds = sortedUnique([inner?.graph_id || inner?.graphId, rootV1?.local?.graph_id]);
  if (localIds.length > 1) conflicts.push(`manifest_identity_conflict:${localIds.join("!=")}`);
  const id = localIds[0] || (inner?.skill ? `ai-codex-skill-${inner.skill}.graph` : null) || pkg?.id || rootV1?.workspace_id || rootV1?.id;
  const aliases = sortedUnique([rootV1?.workspace_id, rootV1?.id, pkg?.id, pkg?.packageId, ...(Array.isArray(inner?.legacyGraphIds) ? inner.legacyGraphIds : [])].filter((value) => value && value !== id));
  const owner = inner?.owner || rootV1?.owner || pkg?.owner || options.owner;
  if (!owner) conflicts.push("needs_input:owner");
  const profiles = sortedUnique([
    ...(Array.isArray(rootV1?.local?.profiles) ? rootV1.local.profiles : []),
    ...(Array.isArray(pkg?.profiles) ? pkg.profiles : []),
    pkg?.profile,
    inner?.graph_type,
    ...(Array.isArray(inner?.profiles) ? inner.profiles : [])
  ]);
  const graphRoot = rootV1?.local?.path || "graph";
  const hasLocalGraph = Boolean(inner || pkg || rootV1?.local || fs.existsSync(path.join(root, graphRoot)));
  const objects = asPaths(pkg?.graph?.objects || inner?.objectIndexes || (fs.existsSync(path.join(root, graphRoot, "objects.json")) ? `${graphRoot}/objects.json` : []));
  const relations = asPaths(pkg?.graph?.relations || inner?.relationIndexes || (fs.existsSync(path.join(root, graphRoot, "relations.json")) ? `${graphRoot}/relations.json` : []));
  const sourceOfTruth = asPaths(inner?.source_of_truth || inner?.sourceOfTruth || inner?.spec || inner?.spec_index || inner?.entrypoint || (fs.existsSync(path.join(root, graphRoot, "specs")) ? `${graphRoot}/specs` : graphRoot));
  const schemas = asPaths(inner?.schemas_path || (fs.existsSync(path.join(root, graphRoot, "schemas")) ? `${graphRoot}/schemas` : []));
  const generated = sortedUnique([...asPaths(inner?.generated_path), ...asPaths(inner?.generatedContextPacks), ...asPaths(inner?.generatedReports), ...asPaths(inner?.coverageReports), ...asPaths(inner?.readinessReports)]);
  const rawSources = sortedUnique([
    ...asPaths(inner?.source_path),
    ...asPaths(inner?.source_boundary),
    ...asPaths(inner?.sourceBoundaries),
    ...asPaths(inner?.sourceInventory),
    ...asPaths(inner?.workflowIntegration),
    ...asPaths(inner?.canonical_projection),
    ...(fs.existsSync(path.join(root, "technology")) ? ["technology"] : []),
    ...(fs.existsSync(path.join(root, "README.md")) ? ["README.md"] : [])
  ]);
  const manifest = {
    $schema: SCHEMA_ID,
    format: FORMAT,
    schema_version: SCHEMA_VERSION,
    id: id || "",
    aliases,
    title: inner?.title || inner?.display_name || rootV1?.title || pkg?.name || pkg?.title || id || "",
    scope: rootV1?.scope || (pkg ? "package" : inner?.graph_type === "skill" ? "skill" : "repository"),
    kind: inner?.graph_type || inner?.kind || (pkg ? "graph_package" : rootV1?.scope || "repository_graph"),
    owner: owner || "",
    profiles,
    graph: hasLocalGraph ? {
      root: graphRoot,
      source_of_truth: sourceOfTruth,
      objects,
      relations,
      schemas,
      generated,
      raw_sources: rawSources
    } : null,
    imports: normalizeImports(rootV1?.imports)
  };
  for (const field of ["version", "conformance_level", "description", "license", "public_safety", "nonclaims"]) {
    if (pkg?.[field] !== undefined) manifest[field] = pkg[field];
  }
  if (inner?.federation !== undefined) manifest.federation = inner.federation;
  if (inner?.graph_runtime !== undefined) manifest.runtime = inner.graph_runtime;
  else if (inner?.graphRuntime !== undefined) manifest.runtime = inner.graphRuntime;
  if (inner?.evolution !== undefined) manifest.evolution = inner.evolution;
  const extensions = {};
  const legacyExtensions = {};
  if (inner?.dna_path) legacyExtensions.dna_path = inner.dna_path;
  if (inner?.graph_kernel) legacyExtensions.graph_kernel = inner.graph_kernel;
  if (Object.keys(legacyExtensions).length) extensions["simai.legacy"] = legacyExtensions;
  if (inner?.hybrid_sot !== undefined) extensions["simai.hybrid_sot"] = inner.hybrid_sot;
  const inlineGraph = Object.fromEntries(["nodes", "edges"].filter((field) => inner?.[field] !== undefined).map((field) => [field, inner[field]]));
  if (Object.keys(inlineGraph).length) extensions["simai.legacy.inline_graph"] = inlineGraph;
  const skillManifest = Object.fromEntries(["display_name", "model", "skill"].filter((field) => inner?.[field] !== undefined).map((field) => [field, inner[field]]));
  if (Object.keys(skillManifest).length) extensions["simai.legacy.skill_manifest"] = skillManifest;
  const camelMetadata = Object.fromEntries([
    ...["status"].filter((field) => inner?.[field] !== undefined).map((field) => [field, inner[field]]),
    ...["legacyPackageId", "ownerSkill", "domainOwnerSkill", "hybridSot", "graphOnlyRuntimeAllowed", "createdAt", "status"].filter((field) => pkg?.[field] !== undefined).map((field) => [field, pkg[field]])
  ]);
  if (Object.keys(camelMetadata).length) extensions["simai.legacy.camel_case_manifest"] = camelMetadata;
  const packageExtensions = {};
  if (pkg?.gates !== undefined) packageExtensions.gates = pkg.gates;
  if (pkg?.results !== undefined) packageExtensions.results = pkg.results;
  if (Object.keys(packageExtensions).length) extensions["mirai-graph.package"] = packageExtensions;
  if (Object.keys(extensions).length) manifest.extensions = extensions;
  for (const field of ["description", "public_safety"]) if (inner?.[field] !== undefined) manifest[field] = inner[field];
  const operational = Object.fromEntries(["type", "canonical_projection", "management_profile", "runtime_context", "entrypoints", "ownerSkill", "domainOwnerSkills", "companionSkills"].filter((field) => inner?.[field] !== undefined).map((field) => [field, inner[field]]));
  if (Object.keys(operational).length) {
    manifest.extensions = { ...(manifest.extensions || {}), "simai.legacy.operational": operational };
  }
  conflicts.push(...validateManifest(manifest, root).filter((error) => !error.startsWith("missing graph.")));
  const uniqueConflicts = sortedUnique(conflicts);
  return {
    status: uniqueConflicts.length ? "needs_input" : "success",
    manifest_status: uniqueConflicts.some((item) => item.startsWith("manifest_identity_conflict")) ? "conflict" : known.length ? "legacy" : "missing",
    source_formats: sources.map((item) => item.format),
    target_schema_version: SCHEMA_VERSION,
    migration_required: known.length > 0,
    identity_map: { canonical: manifest.id || null, aliases },
    conflicts: uniqueConflicts,
    can_execute_now: uniqueConflicts.length === 0,
    operation_mode: "read_only",
    next_action: uniqueConflicts.length ? "resolve conflicts and rerun preview" : "rerun with --apply",
    manifest,
    source_hashes: Object.fromEntries(sources.map((item) => [item.relative, item.hash]))
  };
}

function applyMigration(repo, options = {}) {
  const root = path.resolve(repo);
  const graphDataBefore = graphDataFingerprint(root);
  const plan = migratePlan(root, options);
  if (!plan.migration_required) return { ...plan, operation_mode: "transactional", writes_performed: false };
  if (!plan.can_execute_now) throw new Error(`migration blocked: ${plan.conflicts.join("; ")}`);
  const candidateBytes = jsonBytes(plan.manifest);
  const candidateErrors = validateManifest(plan.manifest, root).filter((error) => !error.startsWith("missing graph."));
  if (candidateErrors.length) throw new Error(`candidate invalid: ${candidateErrors.join("; ")}`);
  const migrationId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${sha256(candidateBytes).slice(7, 19)}`;
  const stateDir = path.join(root, ".mirai-graph", "migrations", migrationId);
  fs.mkdirSync(stateDir, { recursive: true });
  for (const source of detectManifestSources(root)) {
    const backup = path.join(stateDir, source.relative);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(source.absolute, backup);
  }
  fs.writeFileSync(path.join(stateDir, "plan.json"), jsonBytes({ source_hashes: plan.source_hashes, target_hash: sha256(candidateBytes), manifest: plan.manifest }));
  const candidatePath = path.join(stateDir, "graph.json.candidate");
  fs.writeFileSync(candidatePath, candidateBytes);
  try {
    fs.renameSync(candidatePath, path.join(root, "graph.json"));
    for (const relative of ["graph/graph.json", "mirai-graph-package.json"]) {
      const filePath = path.join(root, relative);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const verified = migratePlan(root, options);
    if (!verified.can_execute_now || verified.manifest_status !== "current") {
      throw new Error(`post-activation verification failed: ${verified.conflicts.join("; ")}`);
    }
    const graphDataAfter = graphDataFingerprint(root);
    if (JSON.stringify(graphDataAfter) !== JSON.stringify(graphDataBefore)) throw new Error("graph data changed during manifest-only migration");
    fs.writeFileSync(path.join(stateDir, "receipt.json"), jsonBytes({ status: "complete", migration_id: migrationId, target_hash: sha256(candidateBytes) }));
    return { ...verified, operation_mode: "transactional", writes_performed: true, migration_id: migrationId, rollback_snapshot: stateDir, semantic_equivalence: { status: "success", before: graphDataBefore, after: graphDataAfter } };
  } catch (error) {
    for (const relative of MANIFEST_PATHS) {
      const target = path.join(root, relative);
      const backup = path.join(stateDir, relative);
      if (fs.existsSync(backup)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(backup, target);
      } else if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
    fs.writeFileSync(path.join(stateDir, "receipt.json"), jsonBytes({ status: "rolled_back", migration_id: migrationId, error: String(error.message || error) }));
    throw new Error(`migration rolled back: ${error.message || error}`);
  }
}

module.exports = {
  FORMAT,
  LEGACY_WORKSPACE_SCHEMA,
  MANIFEST_PATHS,
  SCHEMA_ID,
  SCHEMA_VERSION,
  applyMigration,
  graphDataFingerprint,
  detectManifestSources,
  jsonBytes,
  migratePlan,
  readJson,
  sha256,
  validateManifest
};
