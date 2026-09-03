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
const traversal = require("./context-traversal");
const continuity = require("./continuity");
const artifacts = require("./artifact-release");
const technologyCourse = require("./technology-course");

const CONTRACT_VERSION = "1.0.0";
const EXTENSION_KEY = "mirai.project_technology";
const LEGACY_EXTENSION_KEY = "simai.project_technology";
const LOCAL_DIR = path.join(".mirai-graph", "project-technology");
const LEGACY_LOCAL_DIR = path.join(".simai", "project-technology");
const INVENTORY_FILE = "inventory.json";
const BINDING_FILE = "target-provider-binding.json";
const IMPORT_DIR = "provider-exports";
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
  "architecture_contract", "execution_contract_digest", "provider_graph_id",
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
  const completed = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return completed.status === 0 ? completed.stdout.trim() : "";
}

function normalizeRepo(repo) {
  return path.resolve(repo || ".");
}

function runtimeRoot(repo, manifest = null, options = {}) {
  return continuity.stateRoot(repo, manifest || readManifest(repo).manifest, options);
}

function legacyRuntimeState(repo) {
  const root = path.join(repo, LOCAL_DIR);
  return {
    root,
    present: fs.existsSync(root),
    inventory: path.join(root, INVENTORY_FILE),
    binding: path.join(root, BINDING_FILE),
  };
}

function migrateProjectLocalRuntime(repo, manifest, root) {
  const legacy = legacyRuntimeState(repo);
  if (!legacy.present) return { changed: false, blockers: [], migration_ref: null };
  const blockers = [];
  let changed = false;
  if (fs.existsSync(legacy.binding)) {
    const binding = readJson(legacy.binding);
    const identity = bindingValues(binding); blockers.push(...identity.blockers);
    const ref = String(binding.provider_export_ref || "");
    const exportPath = ref && !path.isAbsolute(ref) ? path.resolve(repo, ref) : null;
    const exported = exportPath ? readExport(exportPath) : { export: {}, blockers: ["legacy_provider_export_missing"] };
    blockers.push(...exported.blockers);
    for (const key of Object.keys(identity.values)) if (exported.export[key] !== identity.values[key]) blockers.push(`legacy_${key}_mismatch`);
    if (!blockers.length) {
      const exportBytes = canonicalBytes(exported.export);
      const exportSha = sha256(exportBytes);
      changed = atomicWrite(path.join(root, IMPORT_DIR, `${exportSha}.json`), exportBytes) || changed;
      changed = atomicWrite(path.join(root, BINDING_FILE), canonicalBytes({
        schema_version: "1.0.0", ...identity.values,
        provider_export_ref: `host-local://${IMPORT_DIR}/${exportSha}.json`,
        provider_export_sha256: exportSha,
      })) || changed;
    }
  }
  if (blockers.length) return { changed: false, blockers: [...new Set(blockers)].sort(), migration_ref: null };
  const receipt = {
    schema_version: "1.0.0",
    status: "migrated",
    repository_id: manifest.id,
    source: LOCAL_DIR,
    source_preserved: true,
    active_runtime: "host-local",
  };
  const receiptName = `project-local-runtime-${sha256(canonicalBytes(receipt)).slice(0, 16)}.json`;
  changed = atomicWrite(path.join(root, "migrations", receiptName), canonicalBytes(receipt)) || changed;
  return { changed, blockers: [], migration_ref: `host-local://migrations/${receiptName}` };
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
    continuity_policy: "task_boundary",
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
  const architectureAllowed = new Set([
    "contract_ref", "acceptance_ref", "architecture_owner_id", "lifecycle", "owner_ids", "component_ids",
    "package_ids", "capability_ids", "ownership_boundaries", "required_relations",
    "allowed_relations", "forbidden_relations", "required_dependencies", "forbidden_dependencies",
  ]);
  if (Object.keys(architecture).some((key) => !architectureAllowed.has(key))) blockers.push("provider_architecture_contract_not_bounded");
  const contractRef = String(architecture.contract_ref || "").trim();
  const acceptanceRef = String(architecture.acceptance_ref || "").trim();
  const architectureOwnerId = String(architecture.architecture_owner_id || "").trim();
  const lifecycle = String(architecture.lifecycle || "").trim();
  if (!REF_RE.test(contractRef)) blockers.push("provider_architecture_contract_ref_missing_or_unsafe");
  if (!REF_RE.test(acceptanceRef)) blockers.push("provider_architecture_acceptance_ref_missing_or_unsafe");
  if (!REF_RE.test(architectureOwnerId)) blockers.push("provider_architecture_owner_missing_or_unsafe");
  if (!ACCEPTED_LIFECYCLES.has(lifecycle)) blockers.push("provider_architecture_not_accepted");
  const ownerIds = boundedRefs(architecture.owner_ids, "architecture_owner_ids", blockers);
  const componentIds = boundedRefs(architecture.component_ids, "architecture_component_ids", blockers);
  const packageIds = boundedRefs(architecture.package_ids, "architecture_package_ids", blockers);
  const capabilityIds = boundedRefs(architecture.capability_ids, "architecture_capability_ids", blockers);
  const ownershipBoundaries = [];
  if (!Array.isArray(architecture.ownership_boundaries) || architecture.ownership_boundaries.length === 0) blockers.push("provider_architecture_ownership_boundaries_empty");
  else for (const boundary of architecture.ownership_boundaries) {
    const keys = ["subject_ref", "data_owner", "access_owner", "lifecycle_owner", "interface_owner", "runtime_owner"];
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary) || Object.keys(boundary).some((key) => !keys.includes(key))) {
      blockers.push("provider_architecture_ownership_boundary_invalid"); continue;
    }
    const normalizedBoundary = Object.fromEntries(keys.map((key) => [key, String(boundary[key] || "").trim()]));
    if (Object.values(normalizedBoundary).some((id) => !REF_RE.test(id))) {
      blockers.push("provider_architecture_ownership_boundary_unsafe"); continue;
    }
    if (![...componentIds, ...packageIds, ...capabilityIds].includes(normalizedBoundary.subject_ref)) blockers.push("provider_architecture_ownership_subject_unknown");
    if (["data_owner", "access_owner", "lifecycle_owner", "interface_owner", "runtime_owner"].some((key) => !ownerIds.includes(normalizedBoundary[key]))) blockers.push("provider_architecture_boundary_owner_unapproved");
    ownershipBoundaries.push(normalizedBoundary);
  }
  ownershipBoundaries.sort((a, b) => canonicalBytes(a).localeCompare(canonicalBytes(b)));
  const requiredRelations = boundedRelations(architecture.required_relations, "architecture_required_relations", blockers);
  const allowedRelations = boundedRelations(architecture.allowed_relations, "architecture_allowed_relations", blockers);
  const forbiddenRelations = boundedRelations(architecture.forbidden_relations, "architecture_forbidden_relations", blockers);
  if (requiredRelations.some((item) => forbiddenRelations.includes(item))) blockers.push("provider_architecture_forbidden_relation");
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
      architecture_owner_id: architectureOwnerId,
      lifecycle,
      owner_ids: ownerIds,
      component_ids: componentIds,
      package_ids: packageIds,
      capability_ids: capabilityIds,
      ownership_boundaries: ownershipBoundaries,
      required_relations: requiredRelations,
      allowed_relations: allowedRelations,
      forbidden_relations: forbiddenRelations,
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
  if (Object.hasOwn(payload, "provider_graph_id") && (typeof payload.provider_graph_id !== "string" || !REF_RE.test(payload.provider_graph_id))) blockers.push("provider_graph_id_invalid");
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
  return { export: { schema_version: "1.0.0", ...identity.values, ...normalized.contract, execution_contract_digest: digest, ...(payload.provider_graph_id ? { provider_graph_id: payload.provider_graph_id } : {}) }, blockers: [...new Set(blockers)].sort(), raw_sha256: sha256(bytes) };
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
  const blockers = [];
  let files = trackedFiles(repo);
  const revision = git(repo, "rev-parse", "--verify", "HEAD^{commit}") || null;
  if (!revision) {
    if (fs.existsSync(path.join(repo, ".git")) && !unbornGitBranch(repo)) blockers.push("inventory_git_unavailable");
    else {
      // Ordinary folders and immutable distributions have no Git index. Use
      // only explicitly declared graph/raw sources, never scan arbitrary data.
      const graph = readManifest(repo).manifest?.graph || {};
      const refs = ["graph.json", ...(graph.source_of_truth || []), ...(graph.objects || []),
        ...(graph.relations || []), ...(graph.schemas || []), ...(graph.raw_sources || [])];
      const found = new Set();
      const visited = new Set();
      function collect(relative) {
        if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || relative.includes("\\") || relative.includes(":") || relative.split("/").includes("..") || /[?*\[\]]/.test(relative)) {
          blockers.push("inventory_declared_source_unsafe_or_unsupported"); return;
        }
        if (!safeTrackedFile(relative)) return;
        if (visited.has(relative)) return;
        visited.add(relative);
        if (visited.size > 10000) { blockers.push("inventory_declared_source_budget_exceeded"); return; }
        const absolute = path.join(repo, relative);
        if (!fs.existsSync(absolute)) { blockers.push("inventory_declared_source_missing"); return; }
        if (fs.lstatSync(absolute).isSymbolicLink() || !fs.realpathSync(absolute).startsWith(`${fs.realpathSync(repo)}${path.sep}`)) {
          blockers.push("inventory_declared_source_unsafe_or_unsupported"); return;
        }
        if (fs.statSync(absolute).isDirectory()) {
          for (const name of fs.readdirSync(absolute).sort()) collect(`${relative.replace(/\/$/, "")}/${name}`);
        } else if (fs.statSync(absolute).isFile()) found.add(relative);
        else blockers.push("inventory_declared_source_unsafe_or_unsupported");
      }
      refs.forEach(collect);
      files = [...found];
    }
  }
  for (const relative of files.filter(safeTrackedFile).sort()) {
    const absolute = path.join(repo, relative);
    if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isFile()) continue;
    const bytes = fs.readFileSync(absolute);
    entries.push({ path: relative.split(path.sep).join("/"), bytes: bytes.length, sha256: sha256(bytes) });
  }
  const payload = {
    schema_version: "1.0.0",
    repository_id: readManifest(repo).manifest?.id || path.basename(repo),
    revision,
    files: entries,
  };
  payload.inventory_digest = sha256(canonicalBytes(payload), true);
  if (blockers.length) payload.blockers = [...new Set(blockers)].sort();
  return payload;
}

// A valid new repository has no HEAD commit yet. It may inventory declared
// sources, but must never impersonate a revision-bound provider. Missing tools,
// corrupt refs/index and detached invalid HEAD are not an unborn branch.
function unbornGitBranch(repo) {
  const options = { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } };
  const branch = spawnSync("git", ["symbolic-ref", "--quiet", "HEAD"], options);
  const ref = (branch.stdout || "").trim();
  if (branch.status !== 0 || !ref.startsWith("refs/heads/")) return false;
  const existing = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], options);
  if (existing.status !== 1 || existing.stderr) return false;
  return spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=no"], options).status === 0;
}

function contextTraversal(repoArg, options = {}) {
  if (options.phase === "expand") return traversal.expandContext(repoArg, options.traversalReceipt, options.selectedIds, options);
  if (options.phase === "compile") return traversal.compileContext(repoArg, options.traversalReceipt, options.selection, options);
  if (options.phase === "verify") return traversal.verifyContext(repoArg, options.contextPack, options.usageEvidence, options);
  if (options.phase === "discover") return traversal.discoverContext(repoArg, options.task, options);
  const discovered = traversal.discoverContext(repoArg, options.task, options);
  const nodes = new Map((discovered.traversal_receipt?.nodes || []).map((node) => [node.id, node]));
  return {
    ...discovered,
    operation_id: "mirai.project_technology.context",
    task: discovered.traversal_receipt?.task?.text || "",
    included_objects: (discovered.traversal_receipt?.candidates || []).map((candidate) => ({
      object_id: candidate.id,
      score: candidate.score,
      title: nodes.get(candidate.id)?.title || null,
      summary: nodes.get(candidate.id)?.summary || null,
      source_refs: (nodes.get(candidate.id)?.source_refs || []).map((source) => source.ref),
    })),
    runtime_contract: { graph_first_scope: "routing/capability/policy orientation", raw_source_authoritative: true, canonical_write_allowed: false },
    continuity: continuity.status(normalizeRepo(repoArg), readManifest(normalizeRepo(repoArg)).manifest, options),
  };
}

function context(repoArg, options = {}) {
  const output = contextTraversal(repoArg, options);
  const binding = targetBindingStatus(normalizeRepo(repoArg), options);
  const blockers = [...(output.blockers || [])];
  if (options.significantWork && binding.status !== "ready") blockers.push(...binding.blockers, "accepted_target_binding_required_for_significant_work");
  if (options.significantWork && binding.source_kind === "local") blockers.push(...localVerificationBlockers(normalizeRepo(repoArg), options));
  return { ...output, target_binding: binding, blockers: [...new Set(blockers)].sort(),
    status: blockers.length ? "blocked" : output.status };
}

function localVerificationBlockers(repo, options) {
  const current = continuity.status(repo, readManifest(repo).manifest, options);
  if (!current.terminal_receipt) return ["local_target_verification_missing"];
  return current.terminal_receipt.current_graph_digest === current.graph_digest ? [] : ["local_target_verification_stale"];
}

// Resolve a local target from the same canonical object reader used by context.
// Approval origin is a caller responsibility, just like archive-provider trust.
// Never infer that trust from the decision file or persist it as approval.
function localTargetStatus(repo, manifest, selection, options = {}) {
  const blockers = [];
  const blocked = () => ({ status: "blocked", enabled: true, source_kind: "local", blockers: [...new Set(blockers)].sort(), next_action: "review the local target and verify its owner acceptance" });
  if (!selection || selection.kind !== "local" || Object.keys(selection).some(k => !["kind", "target_id", "acceptance_ref"].includes(k)) ||
      !REF_RE.test(selection.target_id || "") || !REF_RE.test(selection.acceptance_ref || "")) {
    blockers.push("local_target_selection_invalid"); return blocked();
  }
  const graph = traversal.readGraph(repo);
  blockers.push(...graph.blockers);
  if (!(graph.objects instanceof Map)) { blockers.push("local_target_graph_invalid"); return blocked(); }
  const target = graph.objects.get(selection.target_id)?.value;
  const decision = graph.objects.get(selection.acceptance_ref)?.value;
  const decisionRecord = graph.objects.get(selection.acceptance_ref);
  if (decisionRecord && (!decisionRecord.relative.startsWith("graph/specs/") || !localSafeFile(repo, decisionRecord.relative))) blockers.push("local_target_acceptance_source_unsafe");
  if (!target || !["contract", "system"].includes(target.tz_role)) { blockers.push("local_target_missing_or_invalid"); return blocked(); }
  const normalized = normalizeExecutionContract(target.provider_execution_contract);
  blockers.push(...normalized.blockers);
  const contract = normalized.contract;
  const accepted = obj => obj && ACCEPTED_LIFECYCLES.has(obj.lifecycle) &&
    (!obj.readiness || ACCEPTED_LIFECYCLES.has(obj.readiness));
  if (!accepted(target)) blockers.push("local_target_not_accepted");
  const refs = new Set([selection.target_id, contract.goal_binding?.goal_id,
    ...(contract.goal_binding?.done_when_ids || []), ...(contract.constraint_ids || []),
    ...(contract.non_goal_ids || []), ...(contract.deferred_boundary_ids || []),
    ...(contract.decision_refs || []), contract.architecture_contract?.contract_ref]);
  for (const item of contract.requirement_bindings || []) {
    refs.add(item.requirement_id);
    for (const id of [...item.acceptance_ids, ...item.done_when_ids]) refs.add(id);
  }
  // The approval object cannot participate in the digest it signs.
  refs.delete(selection.acceptance_ref); refs.delete(undefined);
  const active = new Set(); const visited = new Set();
  function visit(id) {
    if (active.has(id)) { blockers.push("local_target_required_cycle"); return; }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    for (const relation of graph.relations.filter(r => r.source === id && traversal.REQUIRED_RELATIONS.has(r.type))) {
      if (!ACCEPTED_LIFECYCLES.has(relation.lifecycle || relation.readiness)) blockers.push("local_target_relation_not_accepted");
      if (relation.target === selection.acceptance_ref) continue;
      refs.add(relation.target); visit(relation.target);
    }
    active.delete(id);
  }
  for (const id of [...refs]) visit(id);
  const semanticObjects = []; const sources = [];
  const excluded = new Set(["created_at", "updated_at", "semantic_digest", "execution_contract_digest", "content_revision", "evidence", "approval_ref"]);
  for (const id of [...refs].sort()) {
    const record = graph.objects.get(id);
    if (!record) { blockers.push("local_target_required_object_missing"); continue; }
    if (!accepted(record.value)) blockers.push("local_target_required_object_not_accepted");
    if (!record.relative.startsWith("graph/specs/") || !localSafeFile(repo, record.relative)) { blockers.push("local_target_source_unsafe"); continue; }
    const value = Object.fromEntries(Object.entries(record.value).filter(([key]) => !excluded.has(key)));
    // Digests of referenced tools/evidence belong to content freshness, not meaning.
    const sourceRefs = record.value.source_refs || [];
    const evidenceRefs = record.value.evidence || [];
    if (!Array.isArray(sourceRefs) || !Array.isArray(evidenceRefs) ||
        sourceRefs.some(ref => typeof (typeof ref === "string" ? ref : ref?.ref) !== "string")) {
      blockers.push("local_target_source_refs_invalid"); continue;
    }
    value.source_refs = sourceRefs.map(ref => typeof ref === "string" ? ref : ref.ref).sort();
    semanticObjects.push(value);
    for (const raw of [...sourceRefs, ...evidenceRefs]) {
      const ref = typeof raw === "string" ? raw : raw?.ref;
      if (!localSafeFile(repo, ref)) { blockers.push("local_target_source_unsafe_or_missing"); continue; }
      const bytes = fs.readFileSync(path.join(repo, ref));
      const actual = sha256(bytes, true);
      if (typeof raw === "object" && (raw.sha256 || raw.digest) && (raw.sha256 || raw.digest) !== actual) blockers.push("local_target_source_digest_mismatch");
      sources.push({ ref, sha256: actual });
    }
  }
  const relations = graph.relations.filter(r => refs.has(r.source) && refs.has(r.target)).map(({ _record, ...r }) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => !excluded.has(k))));
  relations.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (relations.some(r => r.type === "conflicts_with")) blockers.push("local_target_conflict");
  if (contract.goal_binding?.done_when_ids.some(id => !contract.requirement_bindings.some(r => r.done_when_ids.includes(id)))) blockers.push("local_target_done_when_uncovered");
  const semanticDigest = sha256(canonicalBytes({ graph_id: manifest.id, target_id: selection.target_id, objects: semanticObjects, relations }), true);
  const executionDigest = sha256(canonicalBytes(contract));
  const contentRevision = sha256(canonicalBytes([...new Map(sources.map(s => [s.ref, s])).values()].sort((a,b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)), true);
  if (target.semantic_digest !== semanticDigest) blockers.push("local_target_semantic_digest_mismatch");
  if (target.content_revision !== contentRevision) blockers.push("local_target_content_stale");
  if (!decision || decision.kind !== "decision" || decision.subtype !== "architecture_baseline_acceptance" || !accepted(decision)) blockers.push("local_target_acceptance_missing_or_invalid");
  const architecture = contract.architecture_contract || {};
  if (!contract.decision_refs?.includes(selection.acceptance_ref) || architecture.acceptance_ref !== selection.acceptance_ref) blockers.push("local_target_acceptance_ref_mismatch");
  if (decision && (decision.graph_id !== manifest.id || decision.target_id !== selection.target_id ||
      decision.owner_id !== architecture.architecture_owner_id || decision.semantic_digest !== semanticDigest ||
      decision.execution_contract_digest !== executionDigest || !REF_RE.test(decision.approval_ref || ""))) blockers.push("local_target_acceptance_identity_mismatch");
  const trust = options.localAcceptance;
  if (!trust || Object.keys(trust).some(k => !["graphId", "targetId", "ownerId", "decisionSha256"].includes(k)) ||
      trust.graphId !== manifest.id || trust.targetId !== selection.target_id || trust.ownerId !== architecture.architecture_owner_id ||
      !decision || trust.decisionSha256 !== sha256(canonicalBytes(decision))) blockers.push("local_target_acceptance_unverified");
  if (!contract.allowed_change_scope?.some(s => s.repository_id === manifest.id)) blockers.push("local_target_repository_scope_unapproved");
  return { ...blocked(), status: blockers.length ? "blocked" : "ready", repository_id: manifest.id,
    target_id: selection.target_id, acceptance_ref: selection.acceptance_ref,
    semantic_digest: semanticDigest, content_revision: contentRevision,
    execution_contract_digest: executionDigest, execution_contract: contract,
    next_action: blockers.length ? "review the local target and verify its owner acceptance" : "none" };
}

function localSafeFile(repo, ref) {
  if (typeof ref !== "string" || !ref || /[:\\\\]/.test(ref) || path.posix.isAbsolute(ref) || ref.split("/").some(p => ["..", ".", "source", "generated"].includes(p)) ||
      SECRET_PARTS.some(p => ref.toLowerCase().includes(p))) return false;
  let current = repo;
  try {
    for (const part of ref.split("/")) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) return false; }
    return fs.statSync(current).isFile();
  } catch (_) { return false; }
}

function targetBindingStatus(repo, options = {}) {
  const manifest = readManifest(repo).manifest;
  const root = runtimeRoot(repo, manifest, options);
  const bindingPath = path.join(root, BINDING_FILE);
  const selection = options.targetSource || manifest?.extensions?.[EXTENSION_KEY]?.target_source;
  if (selection) {
    if (fs.existsSync(bindingPath)) return { status: "blocked", enabled: true, source_kind: "conflict", blockers: ["local_external_target_conflict"], next_action: "explicitly reconcile local and external targets" };
    const local = localTargetStatus(repo, manifest, selection, options);
    if (manifest?.extensions?.[EXTENSION_KEY]?.enabled !== true) {
      local.status = "blocked";
      local.blockers = [...new Set([...local.blockers, "project_technology_disabled"])].sort();
    }
    return local;
  }
  if (!fs.existsSync(bindingPath)) return { status: "not_configured", enabled: false, blockers: [], next_action: "connect an exact target provider binding" };
  let binding;
  try { binding = readJson(bindingPath); } catch (_) { return { status: "blocked", enabled: true, blockers: ["target_binding_invalid"] }; }
  const identity = bindingValues(binding);
  const exportRef = String(binding.provider_export_ref || "");
  const hostPrefix = "host-local://";
  const exportPath = exportRef.startsWith(hostPrefix) ? path.join(root, exportRef.slice(hostPrefix.length)) : null;
  const blockers = [...identity.blockers];
  if (!exportPath || !exportPath.startsWith(`${root}${path.sep}`)) blockers.push("provider_export_outside_host_state");
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
    provider_graph_id: exported.export.provider_graph_id || null,
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "refresh or repair the exact provider binding" : "none",
  };
}

function status(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  let stored = null;
  const root = runtimeRoot(repo, manifestState.manifest, options);
  try { if (fs.existsSync(path.join(root, INVENTORY_FILE))) stored = readJson(path.join(root, INVENTORY_FILE)); } catch (_) { /* stale */ }
  const current = inventory(repo);
  const freshness = stored && stored.inventory_digest === current.inventory_digest ? "current" : stored ? "stale" : "missing";
  const blockers = [...manifestState.blockers, ...ext.blockers, ...(current.blockers || [])];
  if (!stored && legacyRuntimeState(repo).present) blockers.push("project_technology_host_state_migration_required");
  if (ext.contract && ext.contract.enabled === false) blockers.push("project_technology_disabled");
  if (freshness !== "current") blockers.push(`project_technology_inventory_${freshness}`);
  const binding = targetBindingStatus(repo, options);
  if (binding.status === "blocked") blockers.push(...binding.blockers);
  return result("status", "read_only", blockers.length ? "blocked" : "success", {
    repository_id: manifestState.manifest?.id || path.basename(repo),
    enabled: Boolean(ext.contract && ext.contract.enabled && !ext.legacy),
    manifest_status: manifestState.blockers.length ? "blocked" : "current",
    technology_freshness: freshness,
    technology_digest: current.inventory_digest,
    target_binding: binding,
    continuity: continuity.status(repo, manifestState.manifest, options),
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

function plan(repoArg, options = {}) {
  const state = status(repoArg, options);
  return result("plan", "read_only", "success", {
    current_status: state.status,
    target_binding: state.target_binding,
    planned_changes: ["validate_graph_manifest", "migrate_legacy_extension_if_present", "migrate_project_local_runtime_to_host_state", "enable_public_contract", "build_safe_inventory", "verify_target_binding"],
    blockers: state.blockers.filter((item) => !["project_technology_not_configured", "project_technology_migration_required", "project_technology_inventory_missing", "project_technology_inventory_stale"].includes(item)),
    next_action: "rerun the selected operation with --apply",
  });
}

function preview(operation, repoArg, options = {}) {
  const state = status(repoArg, options);
  if (options.targetSource) return result(operation, "preview", "preview", { apply_required: true,
    target_binding: state.target_binding, blockers: state.target_binding.blockers, next_action: "sync --apply with expected graph digest and independently verified acceptance" });
  return result(operation, "preview", "preview", { apply_required: true, current_status: state.status, blockers: state.blockers.filter((item) => item.startsWith("graph_manifest_")), next_action: `${operation} --apply` });
}

function enable(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  if (!manifestState.manifest || manifestState.blockers.length) return result("enable", "transactional", "fail", { blockers: manifestState.blockers, next_action: "repair graph.json" });
  const inventoryPreflight = inventory(repo);
  if (inventoryPreflight.blockers?.length) return result("enable", "transactional", "blocked", { blockers: inventoryPreflight.blockers, next_action: "repair declared graph sources" });
  const manifest = structuredClone(manifestState.manifest);
  const extensions = { ...(manifest.extensions || {}) };
  const legacy = extensions[LEGACY_EXTENSION_KEY];
  delete extensions[LEGACY_EXTENSION_KEY];
  extensions[EXTENSION_KEY] = { ...extensionContract(), ...(extensions[EXTENSION_KEY]?.target_source ? { target_source: extensions[EXTENSION_KEY].target_source } : {}) };
  manifest.extensions = extensions;
  const root = runtimeRoot(repo, manifest, options);
  const runtimeMigration = migrateProjectLocalRuntime(repo, manifest, root);
  if (runtimeMigration.blockers.length) return result("enable", "transactional", "fail", {
    blockers: runtimeMigration.blockers,
    next_action: "repair the project-local runtime before host-state migration",
  });
  const migrationRoot = path.join(root, "migrations", sha256(canonicalBytes({ legacy: legacy || null, head: git(repo, "rev-parse", "HEAD") })).slice(0, 16));
  fs.mkdirSync(migrationRoot, { recursive: true });
  atomicWrite(path.join(migrationRoot, "graph.json.before"), fs.readFileSync(path.join(repo, "graph.json")));
  if (legacy) atomicWrite(path.join(migrationRoot, "legacy-extension.json"), canonicalBytes(legacy));
  const legacyLocal = path.join(repo, LEGACY_LOCAL_DIR);
  if (fs.existsSync(legacyLocal)) atomicWrite(path.join(migrationRoot, "legacy-local-state.json"), canonicalBytes({ status: "preserved_for_rollback", path: LEGACY_LOCAL_DIR }));
  const manifestChanged = atomicWrite(path.join(repo, "graph.json"), canonicalBytes(manifest));
  const inv = inventory(repo);
  const inventoryChanged = atomicWrite(path.join(root, INVENTORY_FILE), canonicalBytes(inv));
  const verified = readManifest(repo);
  if (verified.blockers.length || extensionState(verified.manifest).blockers.length) {
    fs.copyFileSync(path.join(migrationRoot, "graph.json.before"), path.join(repo, "graph.json"));
    return result("enable", "transactional", "fail", { blockers: ["project_technology_enable_rolled_back", ...verified.blockers], next_action: "inspect the rollback receipt" });
  }
  return result("enable", "transactional", "success", {
    changed: manifestChanged || inventoryChanged || runtimeMigration.changed,
    migration_ref: runtimeMigration.migration_ref || `host-local://migrations/${path.basename(migrationRoot)}`,
    technology_digest: inv.inventory_digest,
  });
}

function sync(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  if (options.targetSource) return syncLocalSelection(repo, options);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const blockers = [...manifestState.blockers, ...ext.blockers, ...(inventory(repo).blockers || [])];
  const hostRoot = runtimeRoot(repo, manifestState.manifest, options);
  if (legacyRuntimeState(repo).present && !fs.existsSync(path.join(hostRoot, INVENTORY_FILE))) blockers.push("project_technology_host_state_migration_required");
  if (!ext.contract || ext.legacy || ext.contract.enabled !== true) blockers.push("project_technology_not_enabled");
  const binding = targetBindingStatus(repo, options);
  if (binding.source_kind && binding.status !== "ready") blockers.push(...binding.blockers);
  if (blockers.length) return result("sync", "transactional", "fail", { blockers: [...new Set(blockers)].sort(), next_action: "enable or repair Project Technology" });
  let continuityResult = null;
  if (options.boundary) {
    continuityResult = continuity.sync(repo, manifestState.manifest, options.boundary, options.continuityEvidence, options);
    if (continuityResult.status !== "success") return result("sync", "transactional", continuityResult.status, {
      blockers: continuityResult.blockers,
      continuity: continuityResult.continuity || null,
      next_action: "repair the continuity evidence or reconcile the graph state",
    });
    if (options.boundary === "task_start") return result("sync", "read_only", "success", {
      changed: false,
      technology_digest: inventory(repo).inventory_digest,
      target_binding: targetBindingStatus(repo, options),
      continuity: continuityResult.continuity,
    });
  }
  const inv = inventory(repo);
  const currentManifest = readManifest(repo).manifest;
  const changed = atomicWrite(path.join(runtimeRoot(repo, currentManifest || manifestState.manifest, options), INVENTORY_FILE), canonicalBytes(inv));
  return result("sync", "transactional", "success", {
    changed: changed || Boolean(continuityResult?.changed),
    technology_digest: inv.inventory_digest,
    target_binding: targetBindingStatus(repo, options),
    continuity: continuityResult?.continuity || continuity.status(repo, currentManifest, options),
  });
}

function syncLocalSelection(repo, options, remove = false) {
  const operation = remove ? "disconnect" : "sync";
  const manifestState = readManifest(repo);
  const manifest = manifestState.manifest;
  const ext = extensionState(manifest);
  const binding = targetBindingStatus(repo, options);
  const blockers = [...manifestState.blockers, ...ext.blockers, ...(remove ? [] : binding.blockers)];
  if (!remove && ext.contract?.enabled !== true) blockers.push("project_technology_not_enabled");
  if (options.boundary) blockers.push("local_target_selection_requires_separate_boundary");
  const beforeDigest = continuity.graphDigest(repo);
  if (!options.expectedGraphDigest || beforeDigest !== options.expectedGraphDigest) blockers.push("local_target_compare_and_swap_conflict");
  if (blockers.length) return result(operation, "transactional", "blocked", { target_binding: binding, blockers: [...new Set(blockers)].sort() });
  const root = runtimeRoot(repo, manifest, options);
  const lease = continuity.lock(repo, root);
  if (!lease.acquired) return result(operation, "transactional", "blocked", { blockers: ["continuity_lease_conflict"] });
  const file = path.join(repo, "graph.json"); const inventoryPath = path.join(root, INVENTORY_FILE);
  const before = fs.readFileSync(file);
  const inventoryBefore = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath) : null;
  try {
    if (continuity.graphDigest(repo) !== beforeDigest) return result(operation, "transactional", "blocked", { blockers: ["local_target_compare_and_swap_conflict"] });
    const next = structuredClone(manifest);
    if (remove) delete next.extensions[EXTENSION_KEY].target_source;
    else next.extensions[EXTENSION_KEY].target_source = options.targetSource;
    if (canonicalBytes(next) === canonicalBytes(manifest)) return result(operation, "transactional", "success", { target_binding: binding });
    const backup = path.join(root, "rollback", beforeDigest.slice(7), "graph.json");
    atomicWrite(backup, before);
    atomicWrite(file, canonicalBytes(next));
    const inv = inventory(repo);
    if (inv.blockers?.length) throw new Error("local_target_inventory_failed");
    atomicWrite(inventoryPath, canonicalBytes(inv));
    // No source write besides the selector is permitted in this transaction.
    // Ignore expected Git dirtiness from the selector itself during readback.
    if (!fs.readFileSync(file).equals(Buffer.from(canonicalBytes(next)))) throw new Error("local_target_readback_failed");
    const readback = targetBindingStatus(repo, remove ? { ...options, targetSource: undefined } : options);
    if (!remove && (readback.semantic_digest !== binding.semantic_digest || readback.content_revision !== binding.content_revision ||
        readback.blockers.some(code => code !== "graph_source_not_revision_bound"))) throw new Error("local_target_source_changed_during_selection");
    return result(operation, "transactional", "success", { changed: true, target_binding: readback,
      rollback_ref: `host-local://rollback/${beforeDigest.slice(7)}/graph.json`, technology_digest: inv.inventory_digest });
  } catch (_) {
    let restored = false;
    try {
      atomicWrite(file, before);
      if (inventoryBefore) atomicWrite(inventoryPath, inventoryBefore);
      else if (fs.existsSync(inventoryPath)) fs.unlinkSync(inventoryPath);
      restored = fs.readFileSync(file).equals(before);
    } catch (_) { /* recovery required remains explicit */ }
    return result(operation, "transactional", "fail", { blockers: [restored ? "local_target_rollback_applied" : "local_target_recovery_required"] });
  } finally { continuity.releaseLock(lease); }
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
  const payload = { schema_version: "1.0.0", ...identity.values, ...target.contract, execution_contract_digest: executionContractDigest, provider_graph_id: manifestState.manifest.id };
  const changed = atomicWrite(path.join(repo, EXPORT_FILE), canonicalBytes(payload));
  return result("provide", "transactional", "success", { changed, export_ref: EXPORT_FILE, target_binding: payload });
}

function providerRootFor(exportPath) {
  const completed = spawnSync("git", ["-C", path.dirname(exportPath), "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return completed.status === 0 ? completed.stdout.trim() : null;
}

// This is explicit consumer trust, NOT an assertion read from the provider.
// The caller must obtain it from authenticated, checksum-bound release metadata.
// Keeping it out of the export prevents an archive from authenticating itself.
function archiveProviderIdentity(source, exported, anchor) {
  const fail = code => ({ blockers: [code], ancestors: [] });
  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) return fail("provider_archive_trust_invalid");
  const keys = ["exportSha256", "graphId", "providerRevision", "ancestorRevisions"];
  if (Object.keys(anchor).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(anchor, key))) return fail("provider_archive_trust_invalid");
  if (!/^[0-9a-f]{64}$/.test(anchor.exportSha256 || "") ||
      typeof anchor.graphId !== "string" || !REF_RE.test(anchor.graphId) ||
      !REVISION_RE.test(anchor.providerRevision || "") ||
      !Array.isArray(anchor.ancestorRevisions) || anchor.ancestorRevisions.length > 4096 ||
      anchor.ancestorRevisions.some(rev => typeof rev !== "string" || !REVISION_RE.test(rev) || rev === anchor.providerRevision) ||
      new Set(anchor.ancestorRevisions).size !== anchor.ancestorRevisions.length) return fail("provider_archive_trust_invalid");
  try {
    // Parent aliases such as macOS /var are allowed; the exact bytes are pinned.
    if (fs.lstatSync(source).isSymbolicLink()) return fail("provider_archive_source_unsafe");
    if (!fs.statSync(source).isFile() || fs.statSync(source).size > 1024 * 1024) return fail("provider_archive_source_unsafe");
    const bytes = fs.readFileSync(source);
    if (sha256(bytes) !== anchor.exportSha256 || canonicalBytes(JSON.parse(bytes)) !== canonicalBytes(exported)) return fail("provider_archive_export_digest_mismatch");
  } catch (_) { return fail("provider_archive_source_unsafe"); }
  if (exported.provider_graph_id !== anchor.graphId) return fail("provider_archive_graph_mismatch");
  if (exported.provider_revision !== anchor.providerRevision) return fail("provider_archive_revision_mismatch");
  return { blockers: [], ancestors: anchor.ancestorRevisions };
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
  const archiveRequested = Object.hasOwn(options, "providerArchive");
  if (manifestState.manifest?.extensions?.[EXTENSION_KEY]?.target_source) blockers.push("local_external_target_conflict");
  const archive = archiveRequested ? archiveProviderIdentity(source, read.export, options.providerArchive) : null;
  const providerRoot = archiveRequested ? null : providerRootFor(source);
  if (archive) blockers.push(...archive.blockers);
  else if (!providerRoot) blockers.push("provider_revision_order_unverifiable");
  else if (git(providerRoot, "rev-parse", "HEAD").toLowerCase() !== identity.values.provider_revision) blockers.push("provider_revision_does_not_match_head");
  const root = runtimeRoot(repo, manifestState.manifest, options);
  const currentPath = path.join(root, BINDING_FILE);
  let current = null;
  try { if (fs.existsSync(currentPath)) current = readJson(currentPath); } catch (_) { blockers.push("current_target_binding_invalid"); }
  if (current) {
    const currentExport = targetBindingStatus(repo, options);
    const existingGraphId = currentExport.provider_graph_id;
    if (existingGraphId && existingGraphId !== read.export.provider_graph_id) blockers.push("target_provider_graph_conflict");
    if (!options.refreshBinding) {
      const same = Object.keys(identity.values).every((key) => current[key] === identity.values[key]);
      if (!same) blockers.push("target_provider_conflict", "target_provider_refresh_required");
      else {
        const currentState = targetBindingStatus(repo, options);
        if (currentState.status !== "ready") blockers.push(...currentState.blockers);
        if (currentState.execution_contract_digest !== read.export.execution_contract_digest) blockers.push("target_provider_conflict", "provider_execution_contract_mismatch");
      }
    } else {
      if (current.target_id !== identity.values.target_id) blockers.push("target_provider_target_mismatch");
      if (current.semantic_digest !== identity.values.semantic_digest) blockers.push("target_provider_semantic_mismatch");
      const currentState = targetBindingStatus(repo, options);
      if (currentState.status !== "ready") blockers.push(...currentState.blockers);
      if (currentState.execution_contract_digest !== read.export.execution_contract_digest) blockers.push("provider_execution_contract_refresh_mismatch");
      if (archive) {
        if (current.provider_revision !== identity.values.provider_revision && !archive.ancestors.includes(current.provider_revision)) blockers.push("provider_revision_not_forward");
      } else if (!providerRoot) blockers.push("provider_revision_order_unverifiable");
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
  const imported = path.join(root, IMPORT_DIR, `${exportSha}.json`);
  const binding = { schema_version: "1.0.0", ...identity.values, provider_export_ref: `host-local://${IMPORT_DIR}/${exportSha}.json`, provider_export_sha256: exportSha };
  const transaction = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-project-technology-"));
  const bindingBefore = fs.existsSync(currentPath) ? fs.readFileSync(currentPath) : null;
  const importBefore = fs.existsSync(imported) ? fs.readFileSync(imported) : null;
  try {
    const exportChanged = atomicWrite(imported, exportBytes);
    const bindingChanged = atomicWrite(currentPath, canonicalBytes(binding));
    fs.rmSync(transaction, { recursive: true, force: true });
    return result("connect", "transactional", "success", { changed: exportChanged || bindingChanged, refresh_binding: Boolean(options.refreshBinding), target_binding: targetBindingStatus(repo, options) });
  } catch (_) {
    if (bindingBefore) atomicWrite(currentPath, bindingBefore); else if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
    if (importBefore) atomicWrite(imported, importBefore); else if (fs.existsSync(imported)) fs.unlinkSync(imported);
    fs.rmSync(transaction, { recursive: true, force: true });
    return result("connect", "transactional", "fail", { blockers: ["target_provider_transaction_failed", "target_provider_rollback_applied"], next_action: "inspect filesystem permissions and retry" });
  }
}

function disconnect(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  if (readManifest(repo).manifest?.extensions?.[EXTENSION_KEY]?.target_source) return syncLocalSelection(repo, options, true);
  const root = runtimeRoot(repo, readManifest(repo).manifest, options);
  const bindingPath = path.join(root, BINDING_FILE);
  if (!fs.existsSync(bindingPath)) return result("disconnect", "transactional", "success");
  const backup = path.join(root, "rollback", `binding-${sha256(fs.readFileSync(bindingPath)).slice(0, 16)}.json`);
  atomicWrite(backup, fs.readFileSync(bindingPath));
  fs.unlinkSync(bindingPath);
  return result("disconnect", "transactional", "success", { changed: true, rollback_ref: `host-local://rollback/${path.basename(backup)}` });
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

function repair(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const manifestState = readManifest(repo);
  if (!manifestState.manifest || manifestState.blockers.length) return result("repair", "transactional", "fail", { blockers: manifestState.blockers, next_action: "repair graph.json before Project Technology" });
  const ext = extensionState(manifestState.manifest);
  if (!ext.contract || ext.legacy) return enable(repo, options);
  if (ext.blockers.length) return enable(repo, options);
  const root = runtimeRoot(repo, manifestState.manifest, options);
  if (legacyRuntimeState(repo).present && !fs.existsSync(path.join(root, INVENTORY_FILE))) return enable(repo, options);
  return sync(repo, options);
}

function verifyProviderExport(repoArg, options = {}) {
  const repo = normalizeRepo(repoArg);
  const source = path.resolve(options.source || path.join(repo, EXPORT_FILE));
  const exported = readExport(source);
  const manifestState = readManifest(repo);
  const ext = extensionState(manifestState.manifest);
  const identity = bindingValues(exported.export);
  const blockers = [...exported.blockers, ...manifestState.blockers, ...ext.blockers, ...identity.blockers];
  if (options.significantWork) blockers.push("provider_export_verification_is_not_execution_authority");
  if (!trackedFiles(repo).includes("graph.json") || spawnSync("git", ["diff", "--quiet", "HEAD", "--", "graph.json"], { cwd: repo }).status !== 0) blockers.push("provider_manifest_not_revision_bound");
  if (!source.startsWith(`${repo}${path.sep}`)) blockers.push("provider_export_outside_repository");
  if (ext.contract?.enabled !== true || ext.legacy) blockers.push("project_technology_not_enabled");
  const head = git(repo, "rev-parse", "HEAD");
  if (head !== identity.values.provider_revision) blockers.push("provider_revision_does_not_match_head");
  if (exported.export.provider_graph_id !== manifestState.manifest?.id) blockers.push("provider_archive_graph_mismatch");
  const target = targetContract(repo, identity.values.target_id, identity.values.semantic_digest, manifestState.manifest);
  blockers.push(...target.blockers);
  if (sha256(canonicalBytes(target.contract)) !== exported.export.execution_contract_digest) blockers.push("provider_execution_contract_source_mismatch");
  // Bound supported ancestry; deeper histories need a narrower supported
  // release window rather than unbounded metadata in every consumer.
  const history = git(repo, "rev-list", "--max-count=4098", "HEAD").split("\n").filter(Boolean);
  if (history[0] !== head || history.length > 4097) blockers.push("provider_archive_ancestry_unverifiable_or_too_large");
  return result("verify", "read_only", blockers.length ? "blocked" : "success", {
    blockers: [...new Set(blockers)].sort(),
    provider_archive: blockers.length ? null : {
      exportSha256: exported.raw_sha256, graphId: manifestState.manifest.id,
      providerRevision: head, ancestorRevisions: history.slice(1),
    },
    next_action: blockers.length ? "repair the canonical provider export before packaging" : "seal this anchor in authenticated release metadata",
  });
}

function verify(repoArg, options = {}) {
  if (options.source) return verifyProviderExport(repoArg, options);
  const state = status(repoArg, options);
  const blockers = [...state.blockers];
  const repo = normalizeRepo(repoArg);
  const manifest = readManifest(repo).manifest;
  const continuityResult = continuity.verify(repo, manifest, options);
  if (continuity.continuityPolicy(manifest) === "task_boundary" || options.receiptDigest || options.significantWork) blockers.push(...continuityResult.blockers);
  if (options.significantWork && state.target_binding.status !== "ready") blockers.push("accepted_target_binding_required_for_significant_work");
  if (options.significantWork && state.target_binding.source_kind === "local") blockers.push(...localVerificationBlockers(repo, options));
  return result("verify", "read_only", blockers.length ? "blocked" : "success", {
    repository_id: state.repository_id,
    enabled: state.enabled,
    manifest_status: state.manifest_status,
    technology_freshness: state.technology_freshness,
    technology_digest: state.technology_digest,
    target_binding: state.target_binding,
    continuity: continuityResult.continuity,
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "repair the listed Project Technology blockers" : "none",
  });
}

function execute(operation, repoArg, options = {}) {
  if (operation === "artifact") return artifacts.executeArtifact(repoArg, options);
  if (operation === "course") return technologyCourse.executeCourse(repoArg, options);
  const readOnly = { explain, status, plan, verify, context };
  if (readOnly[operation]) return readOnly[operation](repoArg, options);
  const transactional = { enable, sync, connect, disconnect, provide, disable, repair };
  if (!transactional[operation]) return result(operation, "read_only", "fail", { blockers: ["unsupported_project_technology_operation"] });
  if (!options.apply) return preview(operation, repoArg, options);
  return transactional[operation](repoArg, options);
}

module.exports = {
  CONTRACT_VERSION,
  EXTENSION_KEY,
  LOCAL_DIR,
  bindingValues,
  canonicalBytes,
  compareArtifactReleases: artifacts.compareArtifactReleases,
  connect,
  compileContext: traversal.compileContext,
  compileTechnologyCourse: technologyCourse.compileTechnologyCourse,
  context,
  createArtifactRelease: artifacts.createArtifactRelease,
  discoverContext: traversal.discoverContext,
  disable,
  disconnect,
  enable,
  execute,
  expandContext: traversal.expandContext,
  explain,
  extensionContract,
  inventory,
  inspectArtifactBundle: artifacts.inspectArtifactBundle,
  normalizeExecutionContract,
  normalizeTechnology: technologyCourse.normalizeTechnology,
  continuity,
  plan,
  provide,
  readExport,
  reconcileTechnologyCourse: technologyCourse.reconcileTechnologyCourse,
  repair,
  sha256,
  status,
  sync,
  targetBindingStatus,
  verify,
  verifyProviderExport,
  verifyArtifactRelease: artifacts.verifyArtifactRelease,
  verifyTechnologyCourse: technologyCourse.verifyTechnologyCourse,
  verifyContext: traversal.verifyContext,
};
