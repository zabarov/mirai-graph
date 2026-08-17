"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  FORMAT,
  SCHEMA_ID,
  SCHEMA_VERSION,
  jsonBytes,
  readJson,
  validateManifest,
} = require("../cli/graph-manifest");

const CONTRACT_VERSION = "1.0.0";
const EXTENSION_KEY = "mirai.project_technology";
const LEGACY_EXTENSION_KEY = "simai.project_technology";
const LOCAL_DIR = path.join(".mirai-graph", "project-technology");
const LEGACY_LOCAL_DIR = path.join(".simai", "project-technology");
const INVENTORY_FILE = path.join(LOCAL_DIR, "inventory.json");
const BINDING_FILE = path.join(LOCAL_DIR, "target-provider-binding.json");
const IMPORT_DIR = path.join(LOCAL_DIR, "provider-exports");
const EXPORT_FILE = path.join("graph", "generated", "project-technology", "target-provider-export.json");
const TARGET_DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const REVISION_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@?=+*-]{1,255}$/;
const ACCEPTED_LIFECYCLES = new Set(["accepted", "implemented", "validated", "operating", "evolving"]);
const ACTIONS = new Set(["create", "modify", "delete", "rename", "migrate", "test", "document"]);
const TARGET_EXPORT_KEYS = new Set([
  "schema_version", "target_id", "semantic_digest", "provider_revision",
  "decision_refs", "goal_binding", "requirement_bindings", "constraint_ids",
  "non_goal_ids", "deferred_boundary_ids", "allowed_change_scope",
  "architecture_contract", "execution_contract_digest",
]);
const SECRET_PARTS = [".env", "credential", "secret", "token", "password", "private-key", "id_rsa", ".pem", ".p12"];
const EXCLUDED_PARTS = new Set([".git", ".mirai-graph", ".simai", "node_modules", "vendor", "dist", "build", "coverage", "generated"]);

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function canonicalBytes(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sha256(value, prefix = false) {
  const digest = crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest("hex");
  return prefix ? `sha256:${digest}` : digest;
}

function atomicWrite(filePath, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(bytes)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}`);
  fs.writeFileSync(temp, bytes);
  fs.renameSync(temp, filePath);
  return true;
}

function result(operation, operationMode, status, extra = {}) {
  return {
    schema_version: "1.0.0",
    operation_id: `mirai.project_technology.${operation}`,
    operation_mode: operationMode,
    status,
    changed: false,
    blockers: [],
    warnings: [],
    next_action: "none",
    ...extra,
  };
}

function git(repo, ...args) {
  const completed = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return completed.status === 0 ? completed.stdout.trim() : "";
}

function normalizeRepo(repo) {
  return path.resolve(repo || ".");
}

function readManifest(repo) {
  const manifestPath = path.join(repo, "graph.json");
  if (!fs.existsSync(manifestPath)) return { manifest: null, blockers: ["graph_manifest_missing"] };
  if (fs.lstatSync(manifestPath).isSymbolicLink()) return { manifest: null, blockers: ["graph_manifest_symlink_unsafe"] };
  let manifest;
  try { manifest = readJson(manifestPath); } catch (_) { return { manifest: null, blockers: ["graph_manifest_invalid"] }; }
  const blockers = validateManifest(manifest, repo);
  return { manifest, blockers };
}

function extensionContract() {
  return {
    contract_version: CONTRACT_VERSION,
    enabled: true,
    context_policy: "task_scoped",
    source_boundary: "hybrid_sot",
  };
}

function extensionState(manifest) {
  const extensions = manifest && manifest.extensions && typeof manifest.extensions === "object" ? manifest.extensions : {};
  const current = extensions[EXTENSION_KEY];
  const legacy = extensions[LEGACY_EXTENSION_KEY];
  if (current && typeof current === "object") {
    const blockers = [];
    if (current.contract_version !== CONTRACT_VERSION) blockers.push("project_technology_contract_version_mismatch");
    if (current.context_policy !== "task_scoped") blockers.push("project_technology_context_policy_mismatch");
    if (current.source_boundary !== "hybrid_sot") blockers.push("project_technology_source_boundary_mismatch");
    return { contract: current, legacy: false, blockers };
  }
  if (legacy && typeof legacy === "object") return { contract: legacy, legacy: true, blockers: ["project_technology_migration_required"] };
  return { contract: null, legacy: false, blockers: ["project_technology_not_configured"] };
}

function boundedRefs(value, field, blockers, options = {}) {
  const required = options.required !== false;
  if (!Array.isArray(value) || (required && value.length === 0)) {
    blockers.push(`provider_contract_${field}_empty`);
    return [];
  }
  const output = [];
  for (const item of value) {
    if (typeof item !== "string" || !REF_RE.test(item) || (!options.allowGlob && /[*]/.test(item))) {
      blockers.push(`provider_contract_${field}_unsafe`);
      continue;
    }
    output.push(item);
  }
  return [...new Set(output)].sort();
}

function dependencyCycle(relations) {
  const edges = new Map();
  for (const relation of relations) {
    const parts = relation.split("->");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return true;
    if (!edges.has(parts[0])) edges.set(parts[0], new Set());
    edges.get(parts[0]).add(parts[1]);
  }
  const visited = new Set();
  const visiting = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const child of edges.get(node) || []) if (visit(child)) return true;
    visiting.delete(node); visited.add(node); return false;
  }
  return [...edges.keys()].some(visit);
}

function boundedRelations(value, field, blockers) {
  if (!Array.isArray(value)) {
    blockers.push(`provider_contract_${field}_empty`);
    return [];
  }
  const output = [];
  for (const relation of value) {
    if (typeof relation !== "string") { blockers.push(`provider_contract_${field}_unsafe`); continue; }
    const parts = relation.split("->");
    if (parts.length !== 2 || parts.some((part) => !REF_RE.test(part))) {
      blockers.push(`provider_contract_${field}_unsafe`); continue;
    }
    output.push(`${parts[0]}->${parts[1]}`);
  }
  return [...new Set(output)].sort();
}

function normalizeExecutionContract(value) {
  const blockers = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { contract: {}, blockers: ["provider_execution_contract_missing"] };
  const allowed = new Set(["decision_refs", "goal_binding", "requirement_bindings", "constraint_ids", "non_goal_ids", "deferred_boundary_ids", "allowed_change_scope", "architecture_contract"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) blockers.push("provider_execution_contract_not_bounded");

  const decisionRefs = boundedRefs(value.decision_refs, "decision_refs", blockers);
  const goal = value.goal_binding && typeof value.goal_binding === "object" && !Array.isArray(value.goal_binding) ? value.goal_binding : {};
  if (Object.keys(goal).some((key) => !["goal_id", "done_when_ids"].includes(key))) blockers.push("provider_contract_goal_binding_not_bounded");
  const goalId = String(goal.goal_id || "").trim();
  if (!REF_RE.test(goalId)) blockers.push("provider_contract_goal_id_missing_or_unsafe");
  const doneWhenIds = boundedRefs(goal.done_when_ids, "done_when_ids", blockers);

  const requirementBindings = [];
  if (!Array.isArray(value.requirement_bindings) || value.requirement_bindings.length === 0) blockers.push("provider_contract_requirement_bindings_empty");
  else {
    const seen = new Set();
    for (const item of value.requirement_bindings) {
      if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["requirement_id", "acceptance_ids", "done_when_ids"].includes(key))) {
        blockers.push("provider_contract_requirement_binding_invalid"); continue;
      }
      const requirementId = String(item.requirement_id || "").trim();
      if (!REF_RE.test(requirementId) || seen.has(requirementId)) { blockers.push("provider_contract_requirement_id_missing_duplicate_or_unsafe"); continue; }
      seen.add(requirementId);
      const acceptanceIds = boundedRefs(item.acceptance_ids, "acceptance_ids", blockers);
      const linkedDoneWhen = boundedRefs(item.done_when_ids, "requirement_done_when_ids", blockers);
      if (linkedDoneWhen.some((id) => !doneWhenIds.includes(id))) blockers.push("provider_contract_requirement_done_when_outside_goal");
      requirementBindings.push({ requirement_id: requirementId, acceptance_ids: acceptanceIds, done_when_ids: linkedDoneWhen });
    }
  }
  requirementBindings.sort((a, b) => a.requirement_id.localeCompare(b.requirement_id));

  const constraintIds = boundedRefs(value.constraint_ids, "constraint_ids", blockers);
  const nonGoalIds = boundedRefs(value.non_goal_ids, "non_goal_ids", blockers);
  const deferredIds = boundedRefs(value.deferred_boundary_ids, "deferred_boundary_ids", blockers);
  const scopes = [];
  if (!Array.isArray(value.allowed_change_scope) || value.allowed_change_scope.length === 0) blockers.push("provider_contract_allowed_change_scope_empty");
  else for (const item of value.allowed_change_scope) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["repository_id", "owner_id", "package_id", "file_patterns", "actions"].includes(key))) {
      blockers.push("provider_contract_allowed_change_scope_invalid"); continue;
    }
    const ids = Object.fromEntries(["repository_id", "owner_id", "package_id"].map((key) => [key, String(item[key] || "").trim()]));
    if (Object.values(ids).some((id) => !REF_RE.test(id))) { blockers.push("provider_contract_scope_identity_missing_or_unsafe"); continue; }
    const patterns = boundedRefs(item.file_patterns, "scope_file_patterns", blockers, { allowGlob: true });
    if (patterns.some((entry) => path.isAbsolute(entry) || entry.split(/[\\/]+/).includes("..") || entry.split(/[\\/]+/)[0] === "source")) blockers.push("provider_contract_scope_file_pattern_unsafe");
    const actions = boundedRefs(item.actions, "scope_actions", blockers);
    if (actions.some((action) => !ACTIONS.has(action))) blockers.push("provider_contract_scope_action_unsupported");
    scopes.push({ ...ids, file_patterns: patterns, actions });
  }
  scopes.sort((a, b) => canonicalBytes(a).localeCompare(canonicalBytes(b)));

  const architecture = value.architecture_contract && typeof value.architecture_contract === "object" && !Array.isArray(value.architecture_contract) ? value.architecture_contract : {};
  const architectureAllowed = new Set(["contract_ref", "acceptance_ref", "lifecycle", "owner_ids", "package_ids", "required_dependencies", "forbidden_dependencies"]);
  if (Object.keys(architecture).some((key) => !architectureAllowed.has(key))) blockers.push("provider_architecture_contract_not_bounded");
  const contractRef = String(architecture.contract_ref || "").trim();
  const acceptanceRef = String(architecture.acceptance_ref || "").trim();
  const lifecycle = String(architecture.lifecycle || "").trim();
  if (!REF_RE.test(contractRef)) blockers.push("provider_architecture_contract_ref_missing_or_unsafe");
  if (!REF_RE.test(acceptanceRef)) blockers.push("provider_architecture_acceptance_ref_missing_or_unsafe");
  if (!ACCEPTED_LIFECYCLES.has(lifecycle)) blockers.push("provider_architecture_not_accepted");
  const ownerIds = boundedRefs(architecture.owner_ids, "architecture_owner_ids", blockers);
  const packageIds = boundedRefs(architecture.package_ids, "architecture_package_ids", blockers);
  const requiredDependencies = boundedRelations(architecture.required_dependencies, "required_dependencies", blockers);
  const forbiddenDependencies = boundedRelations(architecture.forbidden_dependencies, "forbidden_dependencies", blockers);
  if (requiredDependencies.some((item) => forbiddenDependencies.includes(item))) blockers.push("provider_architecture_forbidden_dependency");
  if (dependencyCycle(requiredDependencies)) blockers.push("provider_architecture_dependency_cycle");
  if (scopes.some((scope) => !ownerIds.includes(scope.owner_id))) blockers.push("provider_contract_scope_owner_unapproved");
  if (scopes.some((scope) => !packageIds.includes(scope.package_id))) blockers.push("provider_contract_scope_package_unapproved");

  const contract = {
    decision_refs: decisionRefs,
    goal_binding: { goal_id: goalId, done_when_ids: doneWhenIds },
    requirement_bindings: requirementBindings,
    constraint_ids: constraintIds,
    non_goal_ids: nonGoalIds,
    deferred_boundary_ids: deferredIds,
    allowed_change_scope: scopes,
    architecture_contract: {
      contract_ref: contractRef,
      acceptance_ref: acceptanceRef,
      lifecycle,
      owner_ids: ownerIds,
      package_ids: packageIds,
      required_dependencies: requiredDependencies,
      forbidden_dependencies: forbiddenDependencies,
    },
  };
  return { contract, blockers: [...new Set(blockers)].sort() };
}

function specObjectFiles(repo, manifest) {
  const found = [];
  const indexCandidates = [path.join(repo, "graph", "specs", "index.json")];
  if (manifest && manifest.graph) for (const item of manifest.graph.objects || []) if (item.endsWith("index.json")) indexCandidates.push(path.join(repo, item));
  for (const indexPath of [...new Set(indexCandidates)]) {
    if (!fs.existsSync(indexPath)) continue;
    if (fs.lstatSync(indexPath).isSymbolicLink()) continue;
    try {
      const index = readJson(indexPath);
      for (const ref of [...(index.object_files || []), ...(index.objects || [])]) {
        const absolute = path.isAbsolute(ref) ? ref : ref.startsWith("graph/specs/") ? path.join(repo, ref) : path.join(path.dirname(indexPath), ref);
        if (fs.existsSync(absolute) && !fs.lstatSync(absolute).isSymbolicLink() && fs.statSync(absolute).isFile()) found.push(absolute);
      }
    } catch (_) { /* reported by caller if no usable objects */ }
  }
  if (found.length === 0) {
    const objectsDir = path.join(repo, "graph", "specs", "objects");
    if (fs.existsSync(objectsDir)) for (const name of fs.readdirSync(objectsDir).sort()) {
      const candidate = path.join(objectsDir, name);
      if (name.endsWith(".json") && !fs.lstatSync(candidate).isSymbolicLink()) found.push(candidate);
    }
  }
  return [...new Set(found)];
}

function targetContract(repo, targetId, semanticDigest, manifest) {
  const blockers = [];
  const matches = [];
  for (const file of specObjectFiles(repo, manifest)) {
    try { const object = readJson(file); if (object.id === targetId) matches.push({ object, file }); } catch (_) { blockers.push("provider_target_object_invalid"); }
  }
  if (matches.length !== 1) return { contract: {}, blockers: [...blockers, "provider_target_object_count_invalid"] };
  const target = matches[0].object;
  const relative = path.relative(repo, matches[0].file).split(path.sep).join("/");
  if (!trackedFiles(repo).includes(relative)) blockers.push("provider_target_object_not_revision_bound");
  const clean = spawnSync("git", ["diff", "--quiet", "HEAD", "--", relative], { cwd: repo });
  if (clean.status !== 0) blockers.push("provider_target_object_not_revision_bound");
  if (!["system", "contract"].includes(target.tz_role)) blockers.push("provider_target_role_not_canonical");
  if (!ACCEPTED_LIFECYCLES.has(target.lifecycle)) blockers.push("provider_target_not_accepted");
  if (String(target.semantic_digest || "").toLowerCase() !== semanticDigest) blockers.push("provider_target_semantic_digest_mismatch");
  const normalized = normalizeExecutionContract(target.provider_execution_contract);
  return { contract: normalized.contract, blockers: [...new Set([...blockers, ...normalized.blockers])].sort() };
}

function bindingValues(options) {
  const values = {
    target_id: String(options.target_id || options.targetId || "").trim(),
    semantic_digest: String(options.semantic_digest || options.semanticDigest || "").trim().toLowerCase(),
    provider_revision: String(options.provider_revision || options.providerRevision || "").trim().toLowerCase(),
  };
  const blockers = [];
  if (!REF_RE.test(values.target_id)) blockers.push("target_id_invalid");
  if (!TARGET_DIGEST_RE.test(values.semantic_digest)) blockers.push("semantic_digest_invalid");
  if (!REVISION_RE.test(values.provider_revision)) blockers.push("provider_revision_invalid");
  return { values, blockers };
}

function readExport(filePath) {
  const blockers = [];
  if (!filePath || !fs.existsSync(filePath) || fs.lstatSync(filePath).isSymbolicLink()) return { export: {}, blockers: ["provider_export_missing_or_unsafe"] };
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > 64 * 1024) return { export: {}, blockers: ["provider_export_too_large"] };
  let payload;
  try { payload = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")); } catch (_) { return { export: {}, blockers: ["provider_export_invalid"] }; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { export: {}, blockers: ["provider_export_invalid"] };
  if (Object.keys(payload).some((key) => !TARGET_EXPORT_KEYS.has(key))) blockers.push("provider_export_not_bounded");
  const identity = bindingValues(payload); blockers.push(...identity.blockers);
  const executionFields = [
    "decision_refs", "goal_binding", "requirement_bindings", "constraint_ids",
    "non_goal_ids", "deferred_boundary_ids", "allowed_change_scope", "architecture_contract",
  ];
  const normalized = normalizeExecutionContract(Object.fromEntries(executionFields.map((key) => [key, payload[key]])));
  blockers.push(...normalized.blockers);
  const digest = sha256(canonicalBytes(normalized.contract));
  if (!payload.execution_contract_digest) blockers.push("provider_execution_contract_digest_missing");
  else if (payload.execution_contract_digest !== digest) blockers.push("provider_execution_contract_digest_mismatch");
  return { export: { schema_version: "1.0.0", ...identity.values, ...normalized.contract, execution_contract_digest: digest }, blockers: [...new Set(blockers)].sort(), raw_sha256: sha256(bytes) };
}

function trackedFiles(repo) {
  const tracked = git(repo, "ls-files", "-z");
  return tracked ? tracked.split("\0").filter(Boolean) : [];
}

function safeTrackedFile(relative) {
  const lowered = relative.toLowerCase();
  const parts = relative.split(/[\\/]+/);
  if (parts.some((part) => EXCLUDED_PARTS.has(part))) return false;
  if (parts[0] === "source" && parts[1] === "private") return false;
  return !SECRET_PARTS.some((part) => lowered.includes(part));
}

function inventory(repo) {
  const entries = [];
  for (const relative of trackedFiles(repo).filter(safeTrackedFile).sort()) {
    const absolute = path.join(repo, relative);
    if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isFile()) continue;
    const bytes = fs.readFileSync(absolute);
    entries.push({ path: relative.split(path.sep).join("/"), bytes: bytes.length, sha256: sha256(bytes) });
  }
  const payload = {
    schema_version: "1.0.0",
    repository_id: readManifest(repo).manifest?.id || path.basename(repo),
    revision: git(repo, "rev-parse", "HEAD") || null,
    files: entries,
  };
  payload.inventory_digest = sha256(canonicalBytes(payload), true);
  return payload;
}

function loadObjects(repo, manifest) {
  const objects = [];
  for (const file of specObjectFiles(repo, manifest)) {
    try {
      const item = readJson(file);
      const lifecycle = String(item.lifecycle || item.status || "").toLowerCase();
      if (!["archived", "superseded", "deprecated", "retired", "completed"].includes(lifecycle)) objects.push(item);
    } catch (_) { /* unavailable sources are omitted and reported through empty result */ }
  }
  return objects;
}

function context(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const task = String(options.task || "").trim();
  const tokens = new Set(task.toLowerCase().split(/[^a-zа-я0-9_]+/i).filter((item) => item.length > 2));
  const ranked = loadObjects(repo, manifestState.manifest).map((object) => {
    const text = [object.id, object.kind, object.subtype, object.title, object.summary, ...(object.tags || [])].join(" ").toLowerCase();
    const objectTokens = new Set(text.split(/[^a-zа-я0-9_]+/i).filter((item) => item.length > 2));
    const overlap = [...tokens].filter((token) => objectTokens.has(token)).length;
    const baseline = ["skill_core", "skill_policy", "quality_gate"].includes(object.subtype) ? 0.15 : 0;
    return {
      object_id: object.id,
      score: Math.min(1, baseline + overlap * 0.18),
      title: object.title || null,
      summary: object.summary || null,
      source_refs: Array.isArray(object.source_refs) ? object.source_refs.filter((ref) => typeof ref === "string" && !path.isAbsolute(ref)) : [],
    };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || String(a.object_id).localeCompare(String(b.object_id))).slice(0, Number(options.maxObjects || 12));
  const blockers = [...manifestState.blockers, ...ext.blockers];
  if (!ext.contract || ext.legacy || ext.contract.enabled !== true) blockers.push("project_technology_not_enabled");
  if (ranked.length === 0) blockers.push("no_verifiable_runtime_objects");
  return result("context", "read_only", blockers.length ? "blocked" : "success", {
    repository_id: manifestState.manifest?.id || path.basename(repo),
    task,
    included_objects: ranked,
    runtime_contract: { graph_first_scope: "routing/capability/policy orientation", raw_source_authoritative: true, canonical_write_allowed: false },
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "repair graph coverage or load the declared raw source" : "load selected raw source references",
  });
}

function targetBindingStatus(repo) {
  const bindingPath = path.join(repo, BINDING_FILE);
  if (!fs.existsSync(bindingPath)) return { status: "not_configured", enabled: false, blockers: [], next_action: "connect an exact target provider binding" };
  let binding;
  try { binding = readJson(bindingPath); } catch (_) { return { status: "blocked", enabled: true, blockers: ["target_binding_invalid"] }; }
  const identity = bindingValues(binding);
  const exportRef = String(binding.provider_export_ref || "");
  const exportPath = exportRef && !path.isAbsolute(exportRef) ? path.resolve(repo, exportRef) : null;
  const blockers = [...identity.blockers];
  if (!exportPath || !exportPath.startsWith(`${repo}${path.sep}`)) blockers.push("provider_export_outside_repository");
  const exported = exportPath ? readExport(exportPath) : { export: {}, blockers: ["provider_export_missing"] };
  blockers.push(...exported.blockers);
  for (const key of Object.keys(identity.values)) if (exported.export[key] !== identity.values[key]) blockers.push(`${key}_mismatch`);
  if (!binding.provider_export_sha256 || binding.provider_export_sha256 !== exported.raw_sha256) blockers.push("provider_export_digest_mismatch");
  const repositoryId = readManifest(repo).manifest?.id || path.basename(repo);
  if (Array.isArray(exported.export.allowed_change_scope) && !exported.export.allowed_change_scope.some((scope) => scope.repository_id === repositoryId)) {
    blockers.push("provider_contract_repository_scope_unapproved");
  }
  return {
    status: blockers.length ? "blocked" : "ready",
    enabled: true,
    ...identity.values,
    provider_export_ref: exportRef || null,
    provider_export_sha256: binding.provider_export_sha256 || null,
    execution_contract: Object.fromEntries(["decision_refs", "goal_binding", "requirement_bindings", "constraint_ids", "non_goal_ids", "deferred_boundary_ids", "allowed_change_scope", "architecture_contract"].map((key) => [key, exported.export[key]])),
    execution_contract_digest: exported.export.execution_contract_digest || null,
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "refresh or repair the exact provider binding" : "none",
  };
}

function status(repoArg) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  let stored = null;
  try { if (fs.existsSync(path.join(repo, INVENTORY_FILE))) stored = readJson(path.join(repo, INVENTORY_FILE)); } catch (_) { /* stale */ }
  const current = inventory(repo);
  const freshness = stored && stored.inventory_digest === current.inventory_digest ? "current" : stored ? "stale" : "missing";
  const blockers = [...manifestState.blockers, ...ext.blockers];
  if (ext.contract && ext.contract.enabled === false) blockers.push("project_technology_disabled");
  if (freshness !== "current") blockers.push(`project_technology_inventory_${freshness}`);
  const binding = targetBindingStatus(repo);
  if (binding.status === "blocked") blockers.push(...binding.blockers);
  return result("status", "read_only", blockers.length ? "blocked" : "success", {
    repository_id: manifestState.manifest?.id || path.basename(repo),
    enabled: Boolean(ext.contract && ext.contract.enabled && !ext.legacy),
    manifest_status: manifestState.blockers.length ? "blocked" : "current",
    technology_freshness: freshness,
    technology_digest: current.inventory_digest,
    target_binding: binding,
    blockers: [...new Set(blockers)].sort(),
    next_action: ext.legacy ? "run enable --apply to migrate the legacy contract" : blockers.length ? "run plan, then the required transactional operation" : "none",
  });
}

function explain(repoArg) {
  return result("explain", "read_only", "success", {
    repository_id: readManifest(normalizeRepo(repoArg)).manifest?.id || path.basename(normalizeRepo(repoArg)),
    explanation: "Project Technology uses one Mirai Graph manifest to build bounded task context, bind accepted targets and verify repository technology without replacing raw owner sources.",
  });
}

function plan(repoArg) {
  const state = status(repoArg);
  return result("plan", "read_only", "success", {
    current_status: state.status,
    planned_changes: ["validate_graph_manifest", "migrate_legacy_extension_if_present", "enable_public_contract", "build_safe_inventory", "verify_target_binding"],
    blockers: state.blockers.filter((item) => !["project_technology_not_configured", "project_technology_migration_required", "project_technology_inventory_missing", "project_technology_inventory_stale"].includes(item)),
    next_action: "rerun the selected operation with --apply",
  });
}

function preview(operation, repoArg) {
  const state = status(repoArg);
  return result(operation, "preview", "preview", { apply_required: true, current_status: state.status, blockers: state.blockers.filter((item) => item.startsWith("graph_manifest_")), next_action: `${operation} --apply` });
}

function enable(repoArg) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  if (!manifestState.manifest || manifestState.blockers.length) return result("enable", "transactional", "fail", { blockers: manifestState.blockers, next_action: "repair graph.json" });
  const manifest = structuredClone(manifestState.manifest);
  const extensions = { ...(manifest.extensions || {}) };
  const legacy = extensions[LEGACY_EXTENSION_KEY];
  delete extensions[LEGACY_EXTENSION_KEY];
  extensions[EXTENSION_KEY] = extensionContract();
  manifest.extensions = extensions;
  const migrationRoot = path.join(repo, LOCAL_DIR, "migrations", sha256(canonicalBytes({ legacy: legacy || null, head: git(repo, "rev-parse", "HEAD") })).slice(0, 16));
  fs.mkdirSync(migrationRoot, { recursive: true });
  atomicWrite(path.join(migrationRoot, "graph.json.before"), fs.readFileSync(path.join(repo, "graph.json")));
  if (legacy) atomicWrite(path.join(migrationRoot, "legacy-extension.json"), canonicalBytes(legacy));
  const legacyLocal = path.join(repo, LEGACY_LOCAL_DIR);
  if (fs.existsSync(legacyLocal)) atomicWrite(path.join(migrationRoot, "legacy-local-state.json"), canonicalBytes({ status: "preserved_for_rollback", path: LEGACY_LOCAL_DIR }));
  const manifestChanged = atomicWrite(path.join(repo, "graph.json"), canonicalBytes(manifest));
  const inv = inventory(repo);
  const inventoryChanged = atomicWrite(path.join(repo, INVENTORY_FILE), canonicalBytes(inv));
  const verified = readManifest(repo);
  if (verified.blockers.length || extensionState(verified.manifest).blockers.length) {
    fs.copyFileSync(path.join(migrationRoot, "graph.json.before"), path.join(repo, "graph.json"));
    return result("enable", "transactional", "fail", { blockers: ["project_technology_enable_rolled_back", ...verified.blockers], next_action: "inspect the rollback receipt" });
  }
  return result("enable", "transactional", "success", { changed: manifestChanged || inventoryChanged, migration_ref: path.relative(repo, migrationRoot).split(path.sep).join("/"), technology_digest: inv.inventory_digest });
}

function sync(repoArg) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const blockers = [...manifestState.blockers, ...ext.blockers];
  if (!ext.contract || ext.legacy || ext.contract.enabled !== true) blockers.push("project_technology_not_enabled");
  if (blockers.length) return result("sync", "transactional", "fail", { blockers: [...new Set(blockers)].sort(), next_action: "enable or repair Project Technology" });
  const inv = inventory(repo);
  const changed = atomicWrite(path.join(repo, INVENTORY_FILE), canonicalBytes(inv));
  return result("sync", "transactional", "success", { changed, technology_digest: inv.inventory_digest, target_binding: targetBindingStatus(repo) });
}

function provide(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const identity = bindingValues(options);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const blockers = [...identity.blockers, ...manifestState.blockers, ...ext.blockers];
  if (!ext.contract || ext.legacy || ext.contract.enabled !== true) blockers.push("project_technology_not_enabled");
  const head = git(repo, "rev-parse", "HEAD").toLowerCase();
  if (head !== identity.values.provider_revision) blockers.push("provider_revision_does_not_match_head");
  const target = targetContract(repo, identity.values.target_id, identity.values.semantic_digest, manifestState.manifest);
  blockers.push(...target.blockers);
  if (blockers.length) return result("provide", "transactional", "fail", { blockers: [...new Set(blockers)].sort(), next_action: "repair the accepted target contract" });
  const executionContractDigest = sha256(canonicalBytes(target.contract));
  const payload = { schema_version: "1.0.0", ...identity.values, ...target.contract, execution_contract_digest: executionContractDigest };
  const changed = atomicWrite(path.join(repo, EXPORT_FILE), canonicalBytes(payload));
  return result("provide", "transactional", "success", { changed, export_ref: EXPORT_FILE, target_binding: payload });
}

function providerRootFor(exportPath) {
  const completed = spawnSync("git", ["-C", path.dirname(exportPath), "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return completed.status === 0 ? completed.stdout.trim() : null;
}

function connect(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const source = path.resolve(String(options.source || ""));
  const identity = bindingValues(options);
  const read = readExport(source);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const blockers = [...identity.blockers, ...read.blockers, ...manifestState.blockers, ...ext.blockers];
  if (!ext.contract || ext.legacy || ext.contract.enabled !== true) blockers.push("project_technology_not_enabled");
  for (const key of Object.keys(identity.values)) if (read.export[key] !== identity.values[key]) blockers.push(`${key}_mismatch`);
  const providerRoot = providerRootFor(source);
  if (!providerRoot) blockers.push("provider_revision_order_unverifiable");
  else if (git(providerRoot, "rev-parse", "HEAD").toLowerCase() !== identity.values.provider_revision) blockers.push("provider_revision_does_not_match_head");
  const currentPath = path.join(repo, BINDING_FILE);
  let current = null;
  try { if (fs.existsSync(currentPath)) current = readJson(currentPath); } catch (_) { blockers.push("current_target_binding_invalid"); }
  if (current) {
    if (!options.refreshBinding) {
      const same = Object.keys(identity.values).every((key) => current[key] === identity.values[key]);
      if (!same) blockers.push("target_provider_conflict", "target_provider_refresh_required");
      else {
        const currentState = targetBindingStatus(repo);
        if (currentState.status !== "ready") blockers.push(...currentState.blockers);
        if (currentState.execution_contract_digest !== read.export.execution_contract_digest) blockers.push("target_provider_conflict", "provider_execution_contract_mismatch");
      }
    } else {
      if (current.target_id !== identity.values.target_id) blockers.push("target_provider_target_mismatch");
      if (current.semantic_digest !== identity.values.semantic_digest) blockers.push("target_provider_semantic_mismatch");
      const currentState = targetBindingStatus(repo);
      if (currentState.status !== "ready") blockers.push(...currentState.blockers);
      if (currentState.execution_contract_digest !== read.export.execution_contract_digest) blockers.push("provider_execution_contract_refresh_mismatch");
      if (!providerRoot) blockers.push("provider_revision_order_unverifiable");
      else {
        if (current.provider_revision !== identity.values.provider_revision) {
          const ancestry = spawnSync("git", ["-C", providerRoot, "merge-base", "--is-ancestor", current.provider_revision, identity.values.provider_revision]);
          if (ancestry.status !== 0) blockers.push("provider_revision_not_forward");
        }
      }
    }
  } else if (options.refreshBinding) blockers.push("target_provider_binding_missing_for_refresh");
  if (blockers.length) return result("connect", "transactional", "fail", { blockers: [...new Set(blockers)].sort(), next_action: "repair the provider export or request an explicit accepted target change" });
  const exportBytes = canonicalBytes(read.export);
  const exportSha = sha256(exportBytes);
  const imported = path.join(repo, IMPORT_DIR, `${exportSha}.json`);
  const binding = { schema_version: "1.0.0", ...identity.values, provider_export_ref: path.relative(repo, imported).split(path.sep).join("/"), provider_export_sha256: exportSha };
  const transaction = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-project-technology-"));
  const bindingBefore = fs.existsSync(currentPath) ? fs.readFileSync(currentPath) : null;
  const importBefore = fs.existsSync(imported) ? fs.readFileSync(imported) : null;
  try {
    const exportChanged = atomicWrite(imported, exportBytes);
    const bindingChanged = atomicWrite(currentPath, canonicalBytes(binding));
    fs.rmSync(transaction, { recursive: true, force: true });
    return result("connect", "transactional", "success", { changed: exportChanged || bindingChanged, refresh_binding: Boolean(options.refreshBinding), target_binding: targetBindingStatus(repo) });
  } catch (_) {
    if (bindingBefore) atomicWrite(currentPath, bindingBefore); else if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
    if (importBefore) atomicWrite(imported, importBefore); else if (fs.existsSync(imported)) fs.unlinkSync(imported);
    fs.rmSync(transaction, { recursive: true, force: true });
    return result("connect", "transactional", "fail", { blockers: ["target_provider_transaction_failed", "target_provider_rollback_applied"], next_action: "inspect filesystem permissions and retry" });
  }
}

function disconnect(repoArg) {
  const repo = normalizeRepo(repoArg);
  const bindingPath = path.join(repo, BINDING_FILE);
  if (!fs.existsSync(bindingPath)) return result("disconnect", "transactional", "success");
  const backup = path.join(repo, LOCAL_DIR, "rollback", `binding-${sha256(fs.readFileSync(bindingPath)).slice(0, 16)}.json`);
  atomicWrite(backup, fs.readFileSync(bindingPath));
  fs.unlinkSync(bindingPath);
  return result("disconnect", "transactional", "success", { changed: true, rollback_ref: path.relative(repo, backup).split(path.sep).join("/") });
}

function disable(repoArg) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  if (!manifestState.manifest || manifestState.blockers.length) return result("disable", "transactional", "fail", { blockers: manifestState.blockers });
  const manifest = structuredClone(manifestState.manifest);
  const current = extensionState(manifest);
  if (!current.contract || current.legacy) return result("disable", "transactional", "fail", { blockers: current.blockers });
  manifest.extensions[EXTENSION_KEY] = { ...current.contract, enabled: false };
  const changed = atomicWrite(path.join(repo, "graph.json"), canonicalBytes(manifest));
  return result("disable", "transactional", "success", { changed });
}

function repair(repoArg) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  if (!manifestState.manifest || manifestState.blockers.length) return result("repair", "transactional", "fail", { blockers: manifestState.blockers, next_action: "repair graph.json before Project Technology" });
  const ext = extensionState(manifestState.manifest);
  if (!ext.contract || ext.legacy) return enable(repo);
  if (ext.blockers.length) return enable(repo);
  return sync(repo);
}

function verify(repoArg, options = {}) {
  const state = status(repoArg);
  const blockers = [...state.blockers];
  if (options.significantWork && state.target_binding.status !== "ready") blockers.push("accepted_target_binding_required_for_significant_work");
  return result("verify", "read_only", blockers.length ? "blocked" : "success", {
    repository_id: state.repository_id,
    enabled: state.enabled,
    manifest_status: state.manifest_status,
    technology_freshness: state.technology_freshness,
    technology_digest: state.technology_digest,
    target_binding: state.target_binding,
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "repair the listed Project Technology blockers" : "none",
  });
}

function execute(operation, repoArg, options = {}) {
  const readOnly = { explain, status, plan, verify, context };
  if (readOnly[operation]) return readOnly[operation](repoArg, options);
  const transactional = { enable, sync, connect, disconnect, provide, disable, repair };
  if (!transactional[operation]) return result(operation, "read_only", "fail", { blockers: ["unsupported_project_technology_operation"] });
  if (!options.apply) return preview(operation, repoArg);
  return transactional[operation](repoArg, options);
}

module.exports = {
  CONTRACT_VERSION,
  EXTENSION_KEY,
  LOCAL_DIR,
  bindingValues,
  canonicalBytes,
  connect,
  context,
  disable,
  disconnect,
  enable,
  execute,
  explain,
  extensionContract,
  inventory,
  normalizeExecutionContract,
  plan,
  provide,
  readExport,
  repair,
  sha256,
  status,
  sync,
  targetBindingStatus,
  verify,
};
