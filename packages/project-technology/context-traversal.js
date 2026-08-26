"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { readJson, validateManifest } = require("../cli/graph-manifest");

const RECEIPT_CONTRACT = "context-traversal-receipt";
const RECEIPT_VERSION = "1.0.0";
const REQUIRED_RELATIONS = new Set(["requires", "governed_by", "validated_by"]);
const STRUCTURAL_RELATIONS = new Set(["contains", "specializes"]);
const SOURCE_RELATIONS = new Set(["documented_by", "implemented_by"]);
const SUPPORTED_RELATIONS = new Set([
  ...STRUCTURAL_RELATIONS,
  ...REQUIRED_RELATIONS,
  ...SOURCE_RELATIONS,
  "hands_off_to",
  "conflicts_with",
]);
const TERMINAL_KINDS = new Set(["resource", "source", "check", "gate", "constraint"]);
const ACTIVE_READINESS = new Set(["ready", "accepted", "implemented", "validated", "operating", "evolving", "pilot"]);
const LEGACY_ACTIVE_READINESS = new Set([
  "r3_structured", "r3_specified", "r4_integrated", "r4_validated",
  "r4_executable", "r4_evidence_ready", "a4_validated_projection",
  "a6_accepted_local_candidate", "t5_implementation_ready",
  "active_controlled_paid_test",
]);
const BLOCKING_READINESS = new Set(["blocked", "deprecated", "stale", "retired", "superseded"]);
const SECRET_PARTS = [".env", "credential", "secret", "token", "password", "cookie", "private-key", "id_rsa", ".pem", ".p12"];

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function canonicalBytes(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function digest(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalBytes(value));
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort();
}

function git(repo, ...args) {
  const completed = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return completed.status === 0 ? completed.stdout.trim() : "";
}

function gitBlob(repo, relative) {
  if (!relative || !git(repo, "ls-files", "--error-unmatch", "--", relative)) return null;
  const completed = spawnSync("git", ["show", `HEAD:${relative}`], { cwd: repo, encoding: null, maxBuffer: 64 * 1024 * 1024 });
  return completed.status === 0 ? completed.stdout : null;
}

function trackedState(repo) {
  const trackedRun = spawnSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const dirtyRun = spawnSync("git", ["diff", "--name-only", "-z", "HEAD", "--"], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return {
    tracked: new Set(trackedRun.status === 0 ? trackedRun.stdout.split("\0").filter(Boolean) : []),
    dirty: new Set(dirtyRun.status === 0 ? dirtyRun.stdout.split("\0").filter(Boolean) : []),
  };
}

function graphBlob(graph, relative) {
  if (!graph.tracked?.has(relative) || graph.dirty?.has(relative)) return null;
  if (!graph.blobCache.has(relative)) graph.blobCache.set(relative, gitBlob(graph.repo, relative));
  return graph.blobCache.get(relative);
}

function revisionBound(repo, relative) {
  if (!gitBlob(repo, relative)) return false;
  return spawnSync("git", ["diff", "--quiet", "HEAD", "--", relative], { cwd: repo }).status === 0;
}

function safeRelative(value) {
  if (typeof value !== "string" || !value.trim() || path.isAbsolute(value)) return false;
  const lowered = value.toLowerCase();
  if (value.split(/[\\/]+/).includes("..")) return false;
  if (lowered.startsWith("source/private/") || lowered.includes("/source/private/")) return false;
  return !SECRET_PARTS.some((part) => lowered.includes(part));
}

function safeRef(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 512) return false;
  if (/^(repo|https):\/\//.test(value)) return !SECRET_PARTS.some((part) => value.toLowerCase().includes(part));
  return safeRelative(value);
}

const LEGACY_RELATION_TYPES = new Map([
  ["implements", { type: "contains" }],
  ["has_capability", { type: "contains" }],
  ["uses_process", { type: "contains" }],
  ["includes", { type: "contains" }],
  ["member_of", { type: "contains", reverse: true }],
  ["refines", { type: "specializes" }],
  ["depends_on", { type: "requires" }],
  ["requires_current_source_check", { type: "requires" }],
  ["requires_gate", { type: "validated_by" }],
  ["requires_quality_gate", { type: "validated_by" }],
  ["tested_by_scenario", { type: "validated_by" }],
  ["validates", { type: "validated_by", reverse: true }],
  ["assessed_by", { type: "validated_by" }],
  ["blocked_without_gate", { type: "validated_by" }],
  ["conforms_to", { type: "governed_by" }],
  ["constrained_by", { type: "governed_by" }],
  ["evidenced_by", { type: "documented_by" }],
]);

function normalizeObject(value) {
  const normalized = { ...value };
  if (!normalized.kind && normalized.type) normalized.kind = normalized.type;
  if (!normalized.readiness) normalized.readiness = normalized.lifecycle || normalized.status || "accepted";
  if (!value.kind) delete normalized.type;
  return normalized;
}

function normalizeRelation(value) {
  const legacyType = value.type || value.relation_type;
  const mapping = LEGACY_RELATION_TYPES.get(legacyType) || { type: legacyType };
  let source = value.source || value.from;
  let target = value.target || value.to;
  if (mapping.reverse) [source, target] = [target, source];
  const normalized = {
    ...value,
    type: mapping.type,
    source,
    target,
    readiness: value.readiness || value.status || value.lifecycle || "accepted",
  };
  delete normalized.from;
  delete normalized.to;
  delete normalized.relation_type;
  delete normalized.status;
  return normalized;
}

function loadEntry(repo, relative, kind, output, visited = new Set()) {
  if (!safeRelative(relative) || visited.has(relative)) return;
  visited.add(relative);
  const absolute = path.join(repo, relative);
  if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isFile()) return;
  let payload;
  try { payload = readJson(absolute); } catch (_) { output.blockers.push(`invalid_${kind}_entry`); return; }
  const add = (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    output[kind].push({ value: item, relative, sha256: digest(fs.readFileSync(absolute)) });
  };
  if (Array.isArray(payload)) payload.forEach(add);
  else if (Array.isArray(payload[kind])) payload[kind].forEach(add);
  else {
    const files = kind === "objects" ? payload.object_files : payload.relation_files;
    if (Array.isArray(files)) {
      for (const child of files) {
        const next = child.startsWith("graph/") ? child : path.posix.join(path.posix.dirname(relative), child);
        loadEntry(repo, next, kind, output, visited);
      }
    } else add(payload);
  }
}

function readGraph(repoArg) {
  const repo = path.resolve(repoArg || ".");
  const manifestPath = path.join(repo, "graph.json");
  const output = { objects: [], relations: [], blockers: [] };
  if (!fs.existsSync(manifestPath) || fs.lstatSync(manifestPath).isSymbolicLink()) {
    return { repo, manifest: null, revision: null, graphDigest: null, ...output, blockers: ["graph_manifest_missing_or_unsafe"] };
  }
  let manifest;
  try { manifest = readJson(manifestPath); } catch (_) {
    return { repo, manifest: null, revision: null, graphDigest: null, ...output, blockers: ["graph_manifest_invalid"] };
  }
  output.blockers.push(...validateManifest(manifest, repo));
  for (const relative of manifest.graph?.objects || []) loadEntry(repo, relative, "objects", output);
  for (const relative of manifest.graph?.relations || []) loadEntry(repo, relative, "relations", output);
  const objects = new Map();
  for (const record of output.objects) {
    const normalized = normalizeObject(record.value);
    const id = String(normalized.id || "").trim();
    if (!id || objects.has(id)) { output.blockers.push(id ? "duplicate_object_id" : "object_id_missing"); continue; }
    objects.set(id, { ...record, value: normalized });
  }
  const relations = [];
  const relationIds = new Set();
  for (const record of output.relations) {
    const relation = normalizeRelation(record.value);
    const id = String(relation.id || "").trim();
    if (!id || relationIds.has(id)) { output.blockers.push(id ? "duplicate_relation_id" : "relation_id_missing"); continue; }
    relationIds.add(id);
    if (!SUPPORTED_RELATIONS.has(relation.type)) continue;
    if (!objects.has(relation.source) || !objects.has(relation.target)) { output.blockers.push("relation_endpoint_missing"); continue; }
    relations.push({ ...relation, _record: record });
  }
  const revision = git(repo, "rev-parse", "HEAD") || null;
  const state = trackedState(repo);
  for (const relative of unique([
    "graph.json",
    ...[...objects.values()].map((record) => record.relative),
    ...relations.map((relation) => relation._record.relative),
  ])) if (!state.tracked.has(relative) || state.dirty.has(relative)) output.blockers.push("graph_source_not_revision_bound");
  const graphPayload = {
    manifest: { id: manifest.id, scope: manifest.scope, profiles: manifest.profiles, graph: manifest.graph },
    objects: [...objects.values()].map((record) => record.value).sort((a, b) => a.id.localeCompare(b.id)),
    relations: relations.map(({ _record, ...relation }) => relation).sort((a, b) => a.id.localeCompare(b.id)),
    revision,
  };
  return {
    repo,
    manifest,
    revision,
    graphDigest: digest(graphPayload),
    objects,
    relations,
    tracked: state.tracked,
    dirty: state.dirty,
    blobCache: new Map(),
    blockers: unique(output.blockers),
  };
}

function tokenize(value) {
  return unique(String(value || "").toLowerCase().split(/[^a-zа-я0-9_]+/i).filter((item) => item.length > 2));
}

function readinessOf(object) {
  return String(object.readiness || object.lifecycle || object.status || "unknown").toLowerCase();
}

function activeReadiness(value) {
  const normalized = String(value || "").toLowerCase();
  return ACTIVE_READINESS.has(normalized) || LEGACY_ACTIVE_READINESS.has(normalized);
}

function outgoing(graph, id) {
  return graph.relations.filter((relation) => relation.source === id);
}

function sourcePassport(graph, record, value) {
  const raw = [...(Array.isArray(value.source_refs) ? value.source_refs : []), ...(Array.isArray(value.evidence) ? value.evidence : [])];
  const declared = new Map();
  for (const item of raw) {
    const ref = typeof item === "string" ? item : item?.ref;
    if (!safeRef(ref) || declared.has(ref)) continue;
    declared.set(ref, typeof item === "object" && item ? item : { ref });
  }
  return [...declared].sort(([left], [right]) => left.localeCompare(right)).map(([ref, metadata]) => {
    if (/^(repo|https):\/\//.test(ref)) return {
      ref,
      availability: metadata.availability || "declared",
      revision: metadata.revision || graph.revision,
      sha256: metadata.sha256 || metadata.digest || null,
    };
    const absolute = path.join(graph.repo, ref);
    if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isFile()) {
      return { ref, availability: "unavailable", revision: graph.revision, sha256: null };
    }
    const blob = graphBlob(graph, ref);
    return { ref, availability: blob ? "available" : "unbound", revision: graph.revision, sha256: digest(blob || fs.readFileSync(absolute)) };
  }).concat([{ ref: record.relative, availability: "available", revision: graph.revision, sha256: record.sha256 }]);
}

function nodePassport(graph, id) {
  const record = graph.objects.get(id);
  if (!record) return null;
  const value = record.value;
  const children = outgoing(graph, id);
  const computedExpandable = children.length > 0;
  const policy = value.expansion_policy || (TERMINAL_KINDS.has(value.kind) ? "terminal" : "conditional");
  const declaredSourceCount = [...(Array.isArray(value.source_refs) ? value.source_refs : []), ...(Array.isArray(value.evidence) ? value.evidence : [])].length;
  const sources = sourcePassport(graph, record, value);
  const sensitiveMetadata = secretLike({ title: value.title, summary: value.summary, negative_boundaries: value.negative_boundaries, non_goals: value.non_goals });
  return {
    id,
    kind: value.kind || "unknown",
    title: sensitiveMetadata ? "[redacted]" : (value.title || id),
    summary: sensitiveMetadata ? "[redacted]" : (value.summary || ""),
    owner: value.owner || value.owner_id || graph.manifest.owner || null,
    readiness: readinessOf(value),
    authority: value.authority || value.tz_role || "reference",
    expandable: computedExpandable,
    child_kinds: unique(children.map((relation) => graph.objects.get(relation.target)?.value.kind).filter(Boolean)),
    expansion_policy: policy,
    applicability: value.applicability || null,
    negative_boundaries: unique(value.negative_boundaries || value.non_goals || []),
    source_refs: sources,
    omitted_source_ref_count: Math.max(0, declaredSourceCount - (sources.length - 1)),
    sensitive_metadata_detected: sensitiveMetadata,
    access_requirements: (Array.isArray(value.access_requirements) ? value.access_requirements : []).map((item) => ({
      ref: typeof item === "string" ? item : item.ref,
      status: typeof item === "object" && item ? (item.status || "unknown") : "unknown",
      permission: typeof item === "object" && item ? (item.permission || null) : null,
    })).filter((item) => safeRef(item.ref)),
    required_relations: unique(children.filter((relation) => REQUIRED_RELATIONS.has(relation.type)).map((relation) => relation.id)),
    optional_relations: unique(children.filter((relation) => !REQUIRED_RELATIONS.has(relation.type)).map((relation) => relation.id)),
  };
}

function relationPassport(relation) {
  return {
    id: relation.id,
    type: relation.type,
    source: relation.source,
    target: relation.target,
    readiness: relation.readiness || "unknown",
    required: REQUIRED_RELATIONS.has(relation.type),
  };
}

function scoreObject(object, taskTokens) {
  const tokens = tokenize([object.id, object.kind, object.title, object.summary, ...(object.tags || []), ...(object.aliases || [])].join(" "));
  const overlap = taskTokens.filter((token) => tokens.includes(token)).length;
  return Math.min(1, overlap * 0.2 + (object.priority === "required" ? 0.1 : 0));
}

function receiptDigest(receipt) {
  const clone = { ...receipt };
  delete clone.traversal_digest;
  return digest(clone);
}

function result(phase, status, extra = {}) {
  return {
    schema_version: RECEIPT_VERSION,
    operation_id: `mirai.project_technology.context.${phase}`,
    operation_mode: "read_only",
    status,
    changed: false,
    blockers: [],
    warnings: [],
    next_action: "none",
    ...extra,
  };
}

function baseReceipt(graph, task) {
  return {
    contract: RECEIPT_CONTRACT,
    contract_version: RECEIPT_VERSION,
    repository_id: graph.manifest?.id || path.basename(graph.repo),
    task: { text: task, digest: digest(task) },
    graph: { revision: graph.revision, digest: graph.graphDigest },
    visited_ids: [],
    expanded_ids: [],
    frontier_ids: [],
    candidates: [],
    nodes: [],
    relations: [],
    selection_history: [],
    blockers: [],
    warnings: [],
  };
}

function discoverContext(repository, task, options = {}) {
  const graph = readGraph(repository);
  const text = String(task || "").trim();
  const receipt = baseReceipt(graph, text);
  const taskTokens = tokenize(text);
  const incomingNavigational = new Set(graph.relations.filter((relation) => !["hands_off_to", "conflicts_with"].includes(relation.type)).map((relation) => relation.target));
  let roots = [...graph.objects.keys()].filter((id) => !incomingNavigational.has(id));
  if (roots.length === 0) roots = [...graph.objects.keys()];
  const directScores = new Map([...graph.objects.entries()].map(([id, record]) => [id, scoreObject(record.value, taskTokens)]));
  const descendantScore = (root) => {
    const queue = [root]; const seen = new Set(); let best = 0;
    while (queue.length) {
      const id = queue.shift(); if (seen.has(id)) continue; seen.add(id);
      best = Math.max(best, directScores.get(id) || 0);
      for (const relation of outgoing(graph, id)) if (STRUCTURAL_RELATIONS.has(relation.type)) queue.push(relation.target);
    }
    return best;
  };
  const limit = Math.max(1, Math.min(50, Number(options.maxObjects || options.maxCandidates || 12)));
  const allRanked = roots.map((id) => ({ id, score: Math.max(directScores.get(id) || 0, descendantScore(id)) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const positive = allRanked.filter((item) => item.score > 0);
  const ranked = (positive.length ? positive : allRanked).slice(0, limit);
  if (!positive.length && ranked.length) receipt.warnings.push("no_lexical_match_candidates_unranked");
  receipt.candidates = ranked.map((item) => ({ id: item.id, score: item.score }));
  receipt.visited_ids = ranked.map((item) => item.id).sort();
  receipt.frontier_ids = receipt.visited_ids.filter((id) => nodePassport(graph, id)?.expandable);
  receipt.nodes = receipt.visited_ids.map((id) => nodePassport(graph, id));
  const extension = graph.manifest?.extensions?.["mirai.project_technology"];
  const extensionReady = extension?.enabled === true && extension.contract_version === "1.0.0" && extension.context_policy === "task_scoped" && extension.source_boundary === "hybrid_sot";
  receipt.blockers = unique([...graph.blockers, ...(extensionReady ? [] : ["project_technology_not_enabled"]), ...(ranked.length ? [] : ["no_verifiable_runtime_objects"])]);
  receipt.traversal_digest = receiptDigest(receipt);
  return result("discover", receipt.blockers.length ? "blocked" : "success", {
    repository_id: receipt.repository_id,
    traversal_receipt: receipt,
    blockers: receipt.blockers,
    next_action: receipt.blockers.length ? "repair the graph blockers" : "select and expand relevant candidates",
  });
}

function validateReceipt(graph, receipt) {
  const blockers = [];
  if (!receipt || receipt.contract !== RECEIPT_CONTRACT || receipt.contract_version !== RECEIPT_VERSION) blockers.push("context_traversal_receipt_invalid");
  if (receipt?.repository_id !== graph.manifest?.id) blockers.push("context_repository_mismatch");
  if (receipt?.graph?.revision !== graph.revision) blockers.push("context_graph_revision_mismatch");
  if (receipt?.graph?.digest !== graph.graphDigest) blockers.push("context_graph_digest_mismatch");
  if (receipt?.traversal_digest !== receiptDigest(receipt || {})) blockers.push("context_traversal_digest_mismatch");
  return unique([...graph.blockers, ...blockers]);
}

function expandContext(repository, traversalReceipt, selectedIds, options = {}) {
  const graph = readGraph(repository);
  const receipt = JSON.parse(JSON.stringify(traversalReceipt || {}));
  const blockers = validateReceipt(graph, receipt);
  const selected = unique(Array.isArray(selectedIds) ? selectedIds : [selectedIds]);
  for (const id of selected) {
    if (!graph.objects.has(id)) { blockers.push("selected_context_node_missing"); continue; }
    if (!(receipt.visited_ids || []).includes(id)) { blockers.push("selected_context_node_not_discovered"); continue; }
    const children = outgoing(graph, id);
    const alreadyExpanded = (receipt.expanded_ids || []).includes(id);
    receipt.expanded_ids = unique([...(receipt.expanded_ids || []), id]);
    receipt.visited_ids = unique([...(receipt.visited_ids || []), ...children.map((relation) => relation.target)]);
    if (!alreadyExpanded) receipt.selection_history = [...(receipt.selection_history || []), {
      selector: options.selector || "ai",
      selected_ids: [id],
      reason: options.reason || "selected for deeper context",
      confidence: Number(options.confidence ?? 1),
    }];
  }
  receipt.nodes = receipt.visited_ids.map((id) => nodePassport(graph, id)).filter(Boolean);
  const visible = new Set(receipt.visited_ids);
  receipt.relations = graph.relations.filter((relation) => visible.has(relation.source) && visible.has(relation.target)).map(relationPassport).sort((a, b) => a.id.localeCompare(b.id));
  receipt.frontier_ids = receipt.visited_ids.filter((id) => nodePassport(graph, id)?.expandable && !receipt.expanded_ids.includes(id));
  receipt.blockers = unique(blockers);
  receipt.traversal_digest = receiptDigest(receipt);
  return result("expand", receipt.blockers.length ? "blocked" : "success", {
    repository_id: receipt.repository_id,
    traversal_receipt: receipt,
    blockers: receipt.blockers,
    next_action: receipt.blockers.length ? "repair the traversal blockers" : "expand remaining selected branches or compile a selection",
  });
}

function normalizeSelection(selection, receipt) {
  const source = selection && typeof selection === "object" ? selection : {};
  return {
    selector: ["ai", "human", "rule"].includes(source.selector) ? source.selector : "ai",
    task_digest: source.task_digest || receipt.task?.digest || null,
    graph_digest: source.graph_digest || receipt.graph?.digest || null,
    result_owner_id: source.result_owner_id || null,
    selected: (Array.isArray(source.selected) ? source.selected : []).map((item) => typeof item === "string" ? { id: item, reason: "selected", confidence: 1 } : item)
      .filter((item) => item && typeof item.id === "string").sort((a, b) => a.id.localeCompare(b.id)),
    rejected: (Array.isArray(source.rejected) ? source.rejected : []).map((item) => typeof item === "string" ? { id: item, reason: "not applicable" } : item)
      .filter((item) => item && typeof item.id === "string").sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function requiredClosure(graph, initial) {
  const closure = new Set(initial); const queue = [...initial]; const relations = [];
  while (queue.length) {
    const id = queue.shift();
    for (const relation of outgoing(graph, id)) {
      if (!REQUIRED_RELATIONS.has(relation.type)) continue;
      relations.push(relation.id);
      if (!closure.has(relation.target)) { closure.add(relation.target); queue.push(relation.target); }
    }
  }
  return { ids: [...closure].sort(), relationIds: unique(relations) };
}

function sourceClosure(graph, initial) {
  const closure = new Set(initial); const queue = [...initial]; const relations = [];
  while (queue.length) {
    const id = queue.shift();
    for (const relation of outgoing(graph, id)) {
      const targetKind = graph.objects.get(relation.target)?.value.kind;
      const structuralSource = STRUCTURAL_RELATIONS.has(relation.type) && ["resource", "source"].includes(targetKind);
      if (!SOURCE_RELATIONS.has(relation.type) && !structuralSource) continue;
      relations.push(relation.id);
      if (!closure.has(relation.target)) { closure.add(relation.target); queue.push(relation.target); }
    }
  }
  return { ids: [...closure].sort(), relationIds: unique(relations) };
}

function requiredCycle(graph, ids) {
  const allowed = new Set(ids); const visiting = new Set(); const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const relation of outgoing(graph, id)) if (REQUIRED_RELATIONS.has(relation.type) && allowed.has(relation.target) && visit(relation.target)) return true;
    visiting.delete(id); visited.add(id); return false;
  }
  return ids.some(visit);
}

function compileContext(repository, traversalReceipt, selectionInput, options = {}) {
  const graph = readGraph(repository);
  const receipt = traversalReceipt || {};
  const blockers = validateReceipt(graph, receipt);
  const selection = normalizeSelection(selectionInput, receipt);
  const selectedIds = unique(selection.selected.map((item) => item.id));
  const rejectedIds = new Set(selection.rejected.map((item) => item.id));
  if (selection.task_digest !== receipt.task?.digest) blockers.push("selection_task_digest_mismatch");
  if (selection.graph_digest !== graph.graphDigest) blockers.push("selection_graph_digest_mismatch");
  if (!selectedIds.length) blockers.push("context_selection_empty");
  if (!selection.result_owner_id) blockers.push("result_owner_missing");
  for (const item of selection.selected) {
    if (!graph.objects.has(item.id) || !receipt.visited_ids?.includes(item.id)) blockers.push("selected_context_node_not_discovered");
    if (!item.reason || !Number.isFinite(Number(item.confidence))) blockers.push("selected_context_reason_or_confidence_missing");
  }
  for (const item of selection.rejected) if (!item.reason) blockers.push("rejected_context_reason_missing");
  const required = requiredClosure(graph, selectedIds);
  const sources = sourceClosure(graph, required.ids);
  const closure = { ids: sources.ids, relationIds: unique([...required.relationIds, ...sources.relationIds]) };
  const missingRequired = closure.ids.filter((id) => !receipt.visited_ids?.includes(id));
  if (missingRequired.length) blockers.push("required_context_not_discovered");
  if (requiredCycle(graph, required.ids)) blockers.push("required_context_cycle");
  const included = new Set(closure.ids);
  if (selection.result_owner_id && !closure.ids.some((id) => {
    const node = nodePassport(graph, id);
    return id === selection.result_owner_id || node?.owner === selection.result_owner_id;
  })) blockers.push("result_owner_not_in_selected_context");
  const unresolvedBranches = [];
  for (const id of closure.ids) {
    const passport = nodePassport(graph, id);
    if (!passport) continue;
    if (!activeReadiness(passport.readiness)) blockers.push(`context_node_${passport.readiness}`);
    if (passport.omitted_source_ref_count > 0) blockers.push("unsafe_source_reference_omitted");
    if (passport.sensitive_metadata_detected) blockers.push("context_node_sensitive_metadata");
    if (passport.expansion_policy === "terminal" && passport.expandable) blockers.push("terminal_node_has_children");
    if (passport.expansion_policy === "expandable" && !passport.expandable) blockers.push("expandable_node_has_no_children");
    for (const source of passport.source_refs) if (source.availability === "unavailable") blockers.push("required_source_unavailable");
    for (const source of passport.source_refs) if (source.availability === "unbound") blockers.push("required_source_not_revision_bound");
    for (const access of passport.access_requirements) if (!["available", "granted", "not_required"].includes(access.status)) blockers.push("context_access_not_available");
    if (!passport.expandable) continue;
    if (!receipt.expanded_ids?.includes(id)) { unresolvedBranches.push(id); continue; }
    for (const relation of outgoing(graph, id).filter((item) => STRUCTURAL_RELATIONS.has(item.type))) {
      if (included.has(relation.target) || rejectedIds.has(relation.target)) continue;
      unresolvedBranches.push(relation.target);
    }
  }
  if (unresolvedBranches.length) blockers.push("context_branch_decision_incomplete");
  for (const relation of graph.relations) {
    if (relation.type === "conflicts_with" && included.has(relation.source) && included.has(relation.target)) blockers.push("context_selection_conflict");
  }
  const includedIds = [...included].sort();
  const includedNodes = includedIds.map((id) => nodePassport(graph, id)).filter(Boolean);
  const includedRelations = graph.relations.filter((relation) => included.has(relation.source) && included.has(relation.target)).map(relationPassport).sort((a, b) => a.id.localeCompare(b.id));
  for (const relation of includedRelations) if (!activeReadiness(relation.readiness)) blockers.push(`context_relation_${String(relation.readiness).toLowerCase()}`);
  const terminalSourceMap = new Map();
  for (const node of includedNodes.filter((item) => !item.expandable || ["resource", "source"].includes(item.kind))) {
    for (const source of node.source_refs) {
      const key = `${source.ref}:${source.sha256 || ""}:${source.revision || ""}`;
      const current = terminalSourceMap.get(key) || { ...source, node_ids: [] };
      current.node_ids = unique([...current.node_ids, node.id]);
      terminalSourceMap.set(key, current);
    }
  }
  const terminalSources = [...terminalSourceMap.values()].sort((a, b) => a.ref.localeCompare(b.ref) || String(a.sha256).localeCompare(String(b.sha256)));
  for (const source of terminalSources) if (!source.sha256 || !source.revision) blockers.push("required_source_not_hash_bound");
  const contextBudget = Number(options.contextBudget || options.maxBytes || 256 * 1024);
  const base = {
    id: `context_pack.${digest(`${receipt.task?.digest}:${graph.graphDigest}`).slice(7, 23)}`,
    task_id: receipt.task?.digest,
    task_digest: receipt.task?.digest,
    graph_digest: graph.graphDigest,
    graph_revision: graph.revision,
    source_graph: graph.manifest?.id,
    generated_at: graph.revision ? `revision:${graph.revision}` : "revision:unavailable",
    selected_paths: selection.selected,
    rejected_paths: selection.rejected,
    visited_nodes: unique(receipt.visited_ids || []),
    stop_reasons: includedNodes.filter((node) => !node.expandable).map((node) => ({ id: node.id, reason: "terminal" })),
    required_closure: { object_ids: includedIds, relation_ids: closure.relationIds },
    terminal_sources: terminalSources,
    processes: includedNodes.filter((node) => node.kind === "process").map((node) => node.id),
    constraints: includedNodes.filter((node) => node.kind === "constraint").map((node) => node.id),
    validators: includedNodes.filter((node) => ["check", "gate", "validator"].includes(node.kind)).map((node) => node.id),
    included_objects: includedIds,
    included_relations: includedRelations.map((relation) => relation.id),
    evidence: unique(terminalSources.map((source) => source.ref)),
    selection: { method: "client_selection_with_required_closure", selector: selection.selector, result_owner_id: selection.result_owner_id, task_tokens: tokenize(receipt.task?.text), object_explanations: selection.selected.map((item) => ({ id: item.id, relevance_score: Number(item.confidence), reasons: [item.reason] })), relation_explanations: includedRelations.map((relation) => ({ id: relation.id, reason: relation.required ? "required closure" : "selected path", source: relation.source, target: relation.target })) },
    completeness: { status: "ready", unresolved_required_ids: unique(missingRequired), unresolved_branch_ids: unique(unresolvedBranches) },
    omissions: selection.rejected.map((item) => ({ id: item.id, reason: item.reason })),
    limitations: [],
    runtime_contract: { generated_context_authorizes_write: false, raw_source_authoritative: true },
  };
  if (Buffer.byteLength(canonicalBytes(base)) > contextBudget) blockers.push("context_budget_insufficient_for_required_closure");
  const uniqueBlockers = unique(blockers);
  const decisionBlockers = new Set(["context_selection_empty", "result_owner_missing", "context_branch_decision_incomplete", "selected_context_reason_or_confidence_missing", "rejected_context_reason_missing"]);
  const discoveryBlockers = new Set(["required_context_not_discovered"]);
  let status = "ready";
  if (uniqueBlockers.some((item) => discoveryBlockers.has(item))) status = "needs_more_discovery";
  else if (uniqueBlockers.some((item) => decisionBlockers.has(item))) status = "needs_decision";
  else if (uniqueBlockers.length) status = "blocked";
  base.completeness.status = status;
  base.limitations = uniqueBlockers;
  base.context_pack_digest = digest(base);
  return result("compile", status, {
    repository_id: graph.manifest?.id,
    context_pack: base,
    blockers: uniqueBlockers,
    next_action: status === "ready" ? "use the immutable context pack and record usage evidence" : status === "needs_more_discovery" ? "expand the missing required branches" : status === "needs_decision" ? "complete the bounded selection" : "repair the blocking graph or source condition",
  });
}

function secretLike(value) {
  const text = JSON.stringify(value || {});
  return /(?:ghp_|github_pat_|bearer\s+)[a-z0-9_-]{12,}/i.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /(?:^|["'\s/])\.env(?:["'\s/]|$)/i.test(text);
}

function verifyContext(repository, contextPack, usageEvidence, options = {}) {
  const graph = readGraph(repository);
  const blockers = [...graph.blockers];
  if (!contextPack || contextPack.context_pack_digest !== digest(Object.fromEntries(Object.entries(contextPack || {}).filter(([key]) => key !== "context_pack_digest")))) blockers.push("context_pack_digest_mismatch");
  if (contextPack?.graph_digest !== graph.graphDigest || contextPack?.graph_revision !== graph.revision) blockers.push("context_pack_graph_mismatch");
  if (contextPack?.completeness?.status !== "ready") blockers.push("context_pack_not_ready");
  if (contextPack?.runtime_contract?.generated_context_authorizes_write !== false) blockers.push("generated_context_write_authority_forbidden");
  const evidence = Array.isArray(usageEvidence) ? usageEvidence : usageEvidence?.usage || [];
  if (!Array.isArray(evidence) || evidence.length === 0) blockers.push("usage_evidence_missing");
  const coveredSources = new Set(); const coveredValidators = new Set(); const coveredProcesses = new Set();
  for (const item of Array.isArray(evidence) ? evidence : []) {
    if (!item || typeof item !== "object" || item.context_pack_digest !== contextPack?.context_pack_digest) { blockers.push("usage_evidence_context_pack_mismatch"); continue; }
    for (const field of ["source", "applied_rule", "decision", "surface", "validator", "outcome"]) if (!item[field]) blockers.push(`usage_evidence_${field}_missing`);
    if (item.source) coveredSources.add(item.source);
    if (item.validator) coveredValidators.add(item.validator);
    if (item.process) coveredProcesses.add(item.process);
    if (item.applied_rule) coveredProcesses.add(item.applied_rule);
    if (secretLike(item)) blockers.push("usage_evidence_contains_sensitive_data");
  }
  for (const source of contextPack?.terminal_sources || []) if (!coveredSources.has(source.ref)) blockers.push("mandatory_source_not_applied");
  for (const source of contextPack?.terminal_sources || []) {
    if (!safeRef(source.ref)) { blockers.push("context_pack_source_ref_unsafe"); continue; }
    if (/^(repo|https):\/\//.test(source.ref)) continue;
    const absolute = path.join(graph.repo, source.ref);
    if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink() || !fs.statSync(absolute).isFile()) blockers.push("context_pack_source_unavailable");
    else {
      const blob = gitBlob(graph.repo, source.ref);
      if (!blob || !revisionBound(graph.repo, source.ref) || digest(blob) !== source.sha256 || source.revision !== graph.revision) blockers.push("context_pack_source_revision_or_digest_mismatch");
    }
  }
  for (const process of contextPack?.processes || []) if (!coveredProcesses.has(process)) blockers.push("mandatory_process_not_applied");
  for (const validator of contextPack?.validators || []) if (!coveredValidators.has(validator)) blockers.push("mandatory_validator_not_applied");
  if (secretLike(contextPack)) blockers.push("context_pack_contains_sensitive_data");
  const uniqueBlockers = unique(blockers);
  return result("verify", uniqueBlockers.length ? "blocked" : "success", {
    repository_id: graph.manifest?.id,
    context_pack_digest: contextPack?.context_pack_digest || null,
    usage_evidence_digest: evidence.length ? digest(evidence) : null,
    blockers: uniqueBlockers,
    next_action: uniqueBlockers.length ? "repair the context or usage evidence" : "none",
  });
}

module.exports = {
  RECEIPT_CONTRACT,
  REQUIRED_RELATIONS,
  SUPPORTED_RELATIONS,
  compileContext,
  digest,
  discoverContext,
  expandContext,
  readGraph,
  verifyContext,
};
