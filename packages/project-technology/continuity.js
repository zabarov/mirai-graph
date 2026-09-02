"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Manifest refs are portable POSIX-style identifiers even when the host is Windows.
// Convert them to host paths only when joining with the repository root.
const CONTINUITY_FILE = "graph/specs/project-continuity.json";
const CONTEXT_PROJECTION_FILE = "graph/docs/project-context.md";
const BOUNDARIES = new Set(["task_start", "stage_complete", "task_complete"]);
const SECRET_PATTERN = /(?:ghp_|github_pat_|bearer\s+)[a-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:^|["'\s/])\.env(?:["'\s/]|$)|(?:password|token|secret|cookie)\s*[:=]/i;
const PRIVATE_PATH_PATTERN = /(?:^|[^A-Za-z0-9._-])source[\\/](?:private|memory|workflow|handoff)(?:[\\/]|$)/i;
const HOST_PATH_PATTERN = /(?:^|["'\s])(?:\/[Uu]sers\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/;

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

function safeId(value) {
  return String(value || "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function safeText(value, limit = 2000) {
  const text = String(value || "").trim();
  if (!text || text.length > limit || SECRET_PATTERN.test(text) || PRIVATE_PATH_PATTERN.test(text) || HOST_PATH_PATTERN.test(text)) return null;
  return text;
}

function safeRef(value) {
  const text = safeText(value, 512);
  if (!text || path.isAbsolute(text) || text.split(/[\\/]+/).includes("..")) return null;
  return text;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch (_) { return fallback; }
}

function atomicWrite(file, bytes) {
  const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes));
  if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}`);
  fs.writeFileSync(temp, content, { mode: 0o600 });
  fs.renameSync(temp, file);
  return true;
}

function graphIdentity(repo, manifest) {
  return safeId(manifest?.id || path.basename(repo)) || digest(repo).slice(7, 23);
}

function stateRoot(repo, manifest, options = {}) {
  const explicit = options.stateRoot || process.env.MIRAI_GRAPH_STATE_ROOT;
  let root = explicit ? path.resolve(explicit) : null;
  if (!root && process.platform === "win32") root = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "mirai-graph", "project-technology");
  if (!root && process.platform === "darwin") root = path.join(os.homedir(), "Library", "Application Support", "mirai-graph", "project-technology");
  if (!root) root = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), "mirai-graph", "project-technology");
  return path.join(root, graphIdentity(repo, manifest));
}

function listFiles(root, rejectSymlinks = false) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const visit = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) {
        if (rejectSymlinks) throw new Error("continuity_capsule_unsafe_path");
        continue;
      }
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) output.push(file);
    }
  };
  visit(root);
  return output;
}

function isCapsule(repo, manifest) {
  return manifest?.graph?.root === "mirai/graph"
    || fs.existsSync(path.join(repo, "mirai/manifest.yaml"))
    || fs.existsSync(path.join(repo, "mirai/manifest.lock.json"));
}

function capsulePath(repo, relative) {
  let current = repo;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error("continuity_capsule_unsafe_path");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return current;
}

function graphDigest(repo) {
  const entries = [];
  const manifest = path.join(repo, "graph.json");
  if (fs.existsSync(manifest)) entries.push({ path: "graph.json", sha256: digest(fs.readFileSync(manifest)) });
  const capsule = isCapsule(repo, readJson(manifest));
  const specs = capsule ? capsulePath(repo, "mirai/graph") : path.join(repo, "graph", "specs");
  if (capsule) {
    // A fingerprint detects drift; it is not Capsule lock validation or write authority.
    for (const relative of ["mirai/manifest.yaml", "mirai/manifest.lock.json"]) {
      const file = capsulePath(repo, relative);
      entries.push({ path: relative, sha256: fs.existsSync(file) ? digest(fs.readFileSync(file)) : null });
    }
  }
  for (const file of listFiles(specs, capsule)) entries.push({
    path: path.relative(repo, file).split(path.sep).join("/"),
    sha256: digest(fs.readFileSync(file)),
  });
  return digest(entries);
}

function continuityPolicy(manifest) {
  return manifest?.extensions?.["mirai.project_technology"]?.continuity_policy || null;
}

function readObjects(repo) {
  const payload = readJson(path.join(repo, CONTINUITY_FILE), { schema_version: "1.0.0", objects: [] });
  return payload && payload.schema_version === "1.0.0" && Array.isArray(payload.objects) ? payload.objects : [];
}

function latestReceipt(repo, manifest, options = {}) {
  const root = stateRoot(repo, manifest, options);
  const pointer = readJson(path.join(root, "latest-receipt.json"));
  if (!/^receipts\/[a-f0-9]{64}\.json$/.test(pointer?.receipt_ref || "")) return null;
  const file = path.join(root, pointer.receipt_ref);
  const receipt = readJson(file);
  if (!receipt || pointer.receipt_digest !== receipt.receipt_digest || receipt.receipt_digest !== digest(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "receipt_digest")))) return null;
  return receipt;
}

function status(repo, manifest, options = {}) {
  const policy = continuityPolicy(manifest);
  const currentGraphDigest = graphDigest(repo);
  const receipt = latestReceipt(repo, manifest, options);
  let freshness = "not_configured";
  if (policy === "task_boundary") freshness = !receipt ? "missing" : receipt.current_graph_digest === currentGraphDigest ? "current" : "stale";
  const blockers = [];
  if (isCapsule(repo, manifest)) {
    try {
      const loaded = require("./capsule-provider").load(repo);
      if (receipt) {
        const records = new Map(loaded.records.map((item) => [item.object.id, item.object]));
        if (!receipt.capsule_proposal_digest || !Array.isArray(receipt.saved_refs) || !receipt.saved_refs.length
          || receipt.saved_refs.some((id) => !records.has(id) || receipt.saved_object_digests?.[id] !== digest(records.get(id)))) blockers.push("continuity_capsule_receipt_records_mismatch");
      }
    } catch (error) { blockers.push(error.message); }
    if (blockers.length) freshness = "stale";
  }
  return {
    policy,
    authority: isCapsule(repo, manifest) ? "mirai/graph" : "graph/specs",
    host_state_ref: `host-local://${graphIdentity(repo, manifest)}`,
    graph_digest: currentGraphDigest,
    freshness,
    blockers,
    terminal_receipt: receipt ? {
      receipt_digest: receipt.receipt_digest,
      boundary: receipt.boundary,
      task_digest: receipt.task_digest,
      current_graph_digest: receipt.current_graph_digest,
    } : null,
  };
}

function normalizeEvidence(input) {
  const blockers = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { evidence: {}, blockers: ["continuity_evidence_missing"] };
  if (SECRET_PATTERN.test(JSON.stringify(input)) || PRIVATE_PATH_PATTERN.test(JSON.stringify(input)) || HOST_PATH_PATTERN.test(JSON.stringify(input))) blockers.push("continuity_sensitive_or_host_data_forbidden");
  const taskDigest = String(input.task_digest || "").toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(taskDigest)) blockers.push("continuity_task_digest_invalid");
  const outcome = safeText(input.outcome, 1200);
  if (!outcome) blockers.push("continuity_outcome_missing_or_unsafe");
  const requirementRefs = unique((input.requirement_refs || []).map(safeRef));
  const evidenceRefs = unique((input.evidence_refs || []).map(safeRef));
  const checks = (Array.isArray(input.checks) ? input.checks : []).map((item) => {
    if (!item || typeof item !== "object") return null;
    const id = safeRef(item.id); const verdict = String(item.verdict || "").toLowerCase(); const evidenceRef = safeRef(item.evidence_ref);
    if (!id || !["pass", "fail", "blocked"].includes(verdict) || !evidenceRef) return null;
    return { id, verdict, evidence_ref: evidenceRef };
  }).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
  if (!requirementRefs.length) blockers.push("continuity_requirement_refs_missing");
  if (!evidenceRefs.length || !checks.length) blockers.push("continuity_verification_missing");
  if (checks.some((item) => item.verdict !== "pass")) blockers.push("continuity_result_not_verified");
  const changedSurfaces = unique((input.changed_surfaces || []).map(safeRef));
  const caseSignature = safeRef(input.case_signature || "");
  const methodCandidate = safeText(input.method_candidate || "", 1200);
  const decisions = (Array.isArray(input.decisions) ? input.decisions : []).map((item) => {
    if (!item || typeof item !== "object") return null;
    const summary = safeText(item.summary, 1200);
    if (!summary) return null;
    return {
      summary,
      changes_architecture: item.changes_architecture !== false,
      owner_ref: safeRef(item.owner_ref || "") || null,
      approval_ref: safeRef(item.approval_ref || "") || null,
    };
  }).filter(Boolean);
  return {
    evidence: {
      task_digest: taskDigest,
      outcome,
      requirement_refs: requirementRefs,
      evidence_refs: evidenceRefs,
      checks,
      changed_surfaces: changedSurfaces,
      case_signature: caseSignature || digest({ outcome, requirementRefs }).slice(7, 31),
      method_candidate: methodCandidate,
      decisions,
      source_revision: safeRef(input.source_revision || "") || null,
    },
    blockers: unique(blockers),
  };
}

function buildCandidates(existing, evidence, boundary) {
  const signature = digest({ task: evidence.task_digest, outcome: evidence.outcome, requirements: evidence.requirement_refs });
  const suffix = signature.slice(7, 23);
  const promoted = [
    {
      id: `evidence.continuity.${suffix}`,
      kind: "evidence",
      title: `Verified task result ${suffix}`,
      summary: evidence.outcome,
      readiness: "accepted",
      profile: "project_management",
      requirement_refs: evidence.requirement_refs,
      evidence_refs: evidence.evidence_refs,
      checks: evidence.checks,
      changed_surfaces: evidence.changed_surfaces,
      task_digest: evidence.task_digest,
      source_revision: evidence.source_revision,
      provenance_digest: signature,
    },
    {
      id: `regression_case.continuity.${suffix}`,
      kind: "regression_case",
      title: `Verified reusable case ${suffix}`,
      summary: evidence.outcome,
      readiness: "accepted",
      profile: "implementation_control",
      case_signature: evidence.case_signature,
      requirement_refs: evidence.requirement_refs,
      evidence_refs: [`evidence.continuity.${suffix}`],
      task_digest: evidence.task_digest,
      boundary,
      provenance_digest: signature,
    },
  ];
  const proposals = evidence.decisions.map((decision, index) => ({
    id: `decision.proposal.${digest({ signature, decision, index }).slice(7, 23)}`,
    kind: "decision",
    title: `Decision proposal ${index + 1}`,
    summary: decision.summary,
    readiness: decision.approval_ref && !decision.changes_architecture ? "accepted" : "proposal",
    profile: "project_management",
    owner_ref: decision.owner_ref,
    approval_ref: decision.approval_ref,
    source_evidence_ref: `evidence.continuity.${suffix}`,
  }));
  if (evidence.method_candidate) {
    const relatedCaseMap = new Map([...existing, ...promoted]
      .filter((item) => item.kind === "regression_case" && item.case_signature === evidence.case_signature)
      .map((item) => [item.id, item]));
    const relatedCases = [...relatedCaseMap.values()];
    const independentTasks = unique(relatedCases.map((item) => item.task_digest));
    proposals.push({
      id: `lesson.continuity.${digest(evidence.case_signature).slice(7, 23)}`,
      kind: "lesson",
      title: `Reusable method ${evidence.case_signature}`,
      summary: evidence.method_candidate,
      readiness: independentTasks.length >= 2 ? "accepted" : "proposal",
      profile: "project_management",
      case_signature: evidence.case_signature,
      supporting_case_ids: unique(relatedCases.map((item) => item.id)),
      auto_promotion_rule: "two_independent_verified_cases_without_architecture_change",
    });
  }
  return { promoted, proposals };
}

function mergeObjects(existing, additions) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of additions) map.set(item.id, item);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function ensureManifestReference(manifest) {
  const next = JSON.parse(JSON.stringify(manifest));
  next.graph = next.graph || {};
  next.graph.source_of_truth = unique([...(next.graph.source_of_truth || []), "graph/specs"]);
  next.graph.objects = unique([...(next.graph.objects || []), CONTINUITY_FILE]);
  next.graph.generated = unique([...(next.graph.generated || []), CONTEXT_PROJECTION_FILE]);
  next.extensions = next.extensions || {};
  next.extensions["mirai.project_technology"] = {
    ...(next.extensions["mirai.project_technology"] || {}),
    continuity_policy: "task_boundary",
  };
  return next;
}

function contextProjection(manifest, objects, currentDigest) {
  const accepted = objects.filter((item) => item.readiness === "accepted");
  const proposals = objects.filter((item) => item.readiness === "proposal");
  const lines = [
    `# ${manifest.title || manifest.id}: project context`,
    "",
    "> Generated from `graph/specs`. This document is a readable projection, not a source of truth.",
    "",
    `Graph digest: \`${currentDigest}\``,
    "",
    "## Accepted context",
    "",
    ...(accepted.length ? accepted.map((item) => `- **${item.title}** — ${item.summary}`) : ["- No accepted continuity records yet."]),
    "",
    "## Proposals requiring a decision",
    "",
    ...(proposals.length ? proposals.map((item) => `- **${item.title}** — ${item.summary}`) : ["- None."]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function lock(repo, root) {
  const gitBacked = fs.existsSync(path.join(repo, ".git"));
  const file = gitBacked ? path.join(root, "continuity.lock") : path.join(repo, "graph", ".project-technology-continuity.lock");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const fd = fs.openSync(file, "wx", 0o600);
    fs.writeFileSync(fd, canonicalBytes({ pid: process.pid }));
    fs.closeSync(fd);
    return { file, acquired: true };
  } catch (_) { return { file, acquired: false }; }
}

function releaseLock(entry) {
  if (entry?.acquired) try { fs.unlinkSync(entry.file); } catch (_) { /* already removed */ }
}

function capsuleImageGraphDigest(image) {
  const entries = [];
  if (image["graph.json"]) entries.push({ path: "graph.json", sha256: digest(Buffer.from(image["graph.json"], "base64")) });
  for (const ref of ["mirai/manifest.yaml", "mirai/manifest.lock.json"]) entries.push({ path: ref, sha256: image[ref] ? digest(Buffer.from(image[ref], "base64")) : null });
  const graphRefs = Object.keys(image).filter((ref) => ref.startsWith("mirai/graph/")).sort((left, right) => {
    const a = left.split("/"); const b = right.split("/");
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return a.length - b.length;
  });
  for (const ref of graphRefs) entries.push({ path: ref, sha256: digest(Buffer.from(image[ref], "base64")) });
  return digest(entries);
}

function capsuleContinuityDelta(manifest, payloads, evidence, boundary, selectedRef, previousDigest) {
  const refs = manifest.entrypoints.graph.objects;
  const ref = selectedRef || refs.find((item) => Array.isArray(payloads[item])) || refs[0];
  if (!refs.includes(ref)) throw new Error("continuity_capsule_entrypoint_required");
  const records = new Map();
  const arrays = {};
  for (const item of refs) {
    arrays[item] = Array.isArray(payloads[item]) ? [...payloads[item]] : [payloads[item]];
    for (const [index, object] of arrays[item].entries()) {
      if (!object?.id || records.has(object.id)) throw new Error("continuity_capsule_identity_conflict");
      records.set(object.id, { object, ref: item, index });
    }
  }
  const built = buildCandidates([...records.values()].map((item) => item.object), evidence, boundary);
  const additions = [...built.promoted, ...built.proposals];
  const touched = new Set([ref]);
  for (const item of additions) {
    const existing = records.get(item.id);
    if (!existing) { arrays[ref].push(item); continue; }
    const old = existing.object;
    const owned = old.kind === item.kind && (
      (item.id.startsWith("lesson.continuity.") && old.case_signature === item.case_signature && Array.isArray(old.supporting_case_ids))
      || (item.id.startsWith("decision.proposal.") && old.source_evidence_ref === item.source_evidence_ref)
      || (/^(evidence|regression_case)\.continuity\./.test(item.id) && old.provenance_digest === item.provenance_digest && old.task_digest === item.task_digest));
    if (!owned) throw new Error("continuity_capsule_identity_conflict");
    arrays[existing.ref][existing.index] = item;
    touched.add(existing.ref);
  }
  const changes = Object.fromEntries([...touched].sort().map((item) => [item, canonicalBytes(
    !Array.isArray(payloads[item]) && arrays[item].length === 1 ? arrays[item][0] : arrays[item])]));
  const context = { kind: "project_continuity", boundary, evidence, objects_ref: ref,
    previous_graph_digest: previousDigest, saved_refs: built.promoted.map((item) => item.id).sort(),
    proposals: built.proposals.filter((item) => item.readiness === "proposal").map((item) => item.id).sort() };
  return { changes, context };
}

function prepareCapsuleContinuity(repo, boundary, input, options = {}) {
  if (!BOUNDARIES.has(boundary) || boundary === "task_start") throw new Error("continuity_boundary_invalid");
  const normalized = normalizeEvidence(input);
  if (normalized.blockers.length) throw new Error(normalized.blockers.join(","));
  require("./capsule-provider").load(repo);
  const project = require("../../dist/cjs/project");
  const manifest = project.readProjectManifest(repo);
  const payloads = Object.fromEntries(manifest.entrypoints.graph.objects.map((ref) => [ref, readJson(capsulePath(repo, ref))]));
  const next = capsuleContinuityDelta(manifest, payloads, normalized.evidence, boundary, options.objectsRef, graphDigest(repo));
  return project.prepareProjectUpdate(repo, next.changes, next.context);
}

function syncCapsule(repo, manifest, boundary, input, options) {
  if (!options.capsuleProposal || typeof options.capsuleHost?.verify_approval !== "function") return {
    status: "blocked", changed: false, blockers: ["continuity_capsule_write_requires_project_transaction"],
  };
  const normalized = normalizeEvidence(input);
  if (normalized.blockers.length) return { status: "blocked", changed: false, blockers: normalized.blockers };
  const proposal = options.capsuleProposal;
  if (proposal.context?.kind !== "project_continuity" || proposal.context.boundary !== boundary
    || digest(proposal.context.evidence) !== digest(normalized.evidence)) return { status: "blocked", changed: false, blockers: ["continuity_capsule_proposal_input_mismatch"] };
  if (options.expectedGraphDigest && options.expectedGraphDigest !== proposal.context.previous_graph_digest) return { status: "blocked", changed: false, blockers: ["continuity_compare_and_swap_conflict"] };
  let applied;
  try {
    const project = require("../../dist/cjs/project");
    const checked = project.validateProjectUpdateProposal(repo, proposal);
    const beforeManifest = JSON.parse(Buffer.from(checked.before["mirai/manifest.lock.json"], "base64").toString("utf8")).manifest;
    const payloads = Object.fromEntries(beforeManifest.entrypoints.graph.objects.map((ref) => [ref, JSON.parse(Buffer.from(checked.before[ref], "base64").toString("utf8"))]));
    const expected = capsuleContinuityDelta(beforeManifest, payloads, normalized.evidence, boundary, checked.context.objects_ref, capsuleImageGraphDigest(checked.before));
    if (digest(expected.changes) !== digest(checked.changes) || digest(expected.context) !== digest(checked.context)) throw new Error("continuity_capsule_semantic_delta_mismatch");
    applied = project.applyProjectUpdate(repo, checked, options.capsuleHost);
    if (graphDigest(repo) !== capsuleImageGraphDigest(checked.after)) throw new Error("continuity_capsule_post_apply_drift");
    const saved = new Map(require("./capsule-provider").load(repo).records.map((item) => [item.object.id, item.object]));
    if (checked.context.saved_refs.some((id) => !saved.has(id))) throw new Error("continuity_capsule_receipt_records_mismatch");
    const receiptBase = {
      contract: "project-continuity-receipt", contract_version: "1.0.0", repository_id: manifest.id,
      boundary, task_digest: normalized.evidence.task_digest, input_digest: digest(normalized.evidence),
      previous_graph_digest: proposal.context.previous_graph_digest, current_graph_digest: graphDigest(repo),
      saved_refs: proposal.context.saved_refs, proposals: proposal.context.proposals, omissions: [], freshness: "current",
      saved_object_digests: Object.fromEntries(checked.context.saved_refs.map((id) => [id, digest(saved.get(id))])),
      capsule_transaction_digest: applied.receipt.digest, capsule_proposal_digest: proposal.digest,
      rollback_ref: `local-state://project-updates/${proposal.digest.slice(7)}.journal.json`,
    };
    const receipt = { ...receiptBase, receipt_digest: digest(receiptBase) };
    const root = stateRoot(repo, manifest, options);
    const receiptName = `receipts/${receipt.receipt_digest.slice(7)}.json`;
    atomicWrite(path.join(root, receiptName), canonicalBytes(receipt));
    atomicWrite(path.join(root, "latest-receipt.json"), canonicalBytes({ receipt_ref: receiptName, receipt_digest: receipt.receipt_digest }));
    return { status: "success", changed: applied.changed, blockers: [], continuity: { ...status(repo, manifest, options), ...receipt } };
  } catch (error) {
    const pending = fs.existsSync(path.join(repo, ".mirai/project-update.pending.json"));
    return { status: "blocked", changed: Boolean(applied?.changed) || pending, blockers: [error.message],
      transaction: { proposal_digest: proposal.digest, status: applied ? "committed" : pending ? "pending" : "rejected", receipt_digest: applied?.receipt.digest || null },
      next_safe_action: applied ? "retry_receipt_projection_with_same_proposal" : "inspect_pending_transaction_before_retry" };
  }
}

function sync(repoArg, manifest, boundary, input, options = {}) {
  const repo = path.resolve(repoArg || ".");
  if (!BOUNDARIES.has(boundary)) return { status: "fail", changed: false, blockers: ["continuity_boundary_invalid"] };
  if (boundary === "task_start") {
    const current = status(repo, manifest, options);
    return { status: current.blockers.length ? "blocked" : "success", changed: false, blockers: current.blockers,
      continuity: { ...current, input_digest: input ? digest(input) : null, omissions: ["task_start_is_read_only"] } };
  }
  if (isCapsule(repo, manifest)) return syncCapsule(repo, manifest, boundary, input, options);
  const normalized = normalizeEvidence(input);
  if (normalized.blockers.length) return { status: "blocked", changed: false, blockers: normalized.blockers };
  const beforeDigest = graphDigest(repo);
  if (options.expectedGraphDigest && options.expectedGraphDigest !== beforeDigest) return { status: "blocked", changed: false, blockers: ["continuity_compare_and_swap_conflict"] };
  const root = stateRoot(repo, manifest, options);
  const lease = lock(repo, root);
  if (!lease.acquired) return { status: "blocked", changed: false, blockers: ["continuity_lease_conflict"] };
  const manifestPath = path.join(repo, "graph.json");
  const continuityPath = path.join(repo, CONTINUITY_FILE);
  const projectionPath = path.join(repo, CONTEXT_PROJECTION_FILE);
  const manifestBefore = fs.readFileSync(manifestPath);
  const continuityBefore = fs.existsSync(continuityPath) ? fs.readFileSync(continuityPath) : null;
  const projectionBefore = fs.existsSync(projectionPath) ? fs.readFileSync(projectionPath) : null;
  try {
    if (graphDigest(repo) !== beforeDigest) return { status: "blocked", changed: false, blockers: ["continuity_compare_and_swap_conflict"] };
    const existing = readObjects(repo);
    const built = buildCandidates(existing, normalized.evidence, boundary);
    const objects = mergeObjects(existing, [...built.promoted, ...built.proposals]);
    const nextManifest = ensureManifestReference(manifest);
    const backupId = digest({ beforeDigest, task: normalized.evidence.task_digest }).slice(7, 23);
    const backupRoot = path.join(root, "rollback", backupId);
    atomicWrite(path.join(backupRoot, "graph.json"), manifestBefore);
    if (continuityBefore) atomicWrite(path.join(backupRoot, "project-continuity.json"), continuityBefore);
    if (projectionBefore) atomicWrite(path.join(backupRoot, "project-context.md"), projectionBefore);
    const manifestChanged = atomicWrite(manifestPath, canonicalBytes(nextManifest));
    const continuityChanged = atomicWrite(continuityPath, canonicalBytes({ schema_version: "1.0.0", objects }));
    const currentDigest = graphDigest(repo);
    const projectionChanged = atomicWrite(projectionPath, contextProjection(nextManifest, objects, currentDigest));
    const receiptBase = {
      contract: "project-continuity-receipt",
      contract_version: "1.0.0",
      repository_id: nextManifest.id,
      boundary,
      task_digest: normalized.evidence.task_digest,
      input_digest: digest(normalized.evidence),
      previous_graph_digest: beforeDigest,
      current_graph_digest: currentDigest,
      saved_refs: built.promoted.map((item) => item.id).sort(),
      proposals: built.proposals.filter((item) => item.readiness === "proposal").map((item) => item.id).sort(),
      omissions: [],
      freshness: "current",
      rollback_ref: `host-local://${graphIdentity(repo, nextManifest)}/rollback/${backupId}`,
    };
    const receipt = { ...receiptBase, receipt_digest: digest(receiptBase) };
    const receiptName = `receipts/${receipt.receipt_digest.slice(7)}.json`;
    atomicWrite(path.join(root, receiptName), canonicalBytes(receipt));
    atomicWrite(path.join(root, "latest-receipt.json"), canonicalBytes({ receipt_ref: receiptName, receipt_digest: receipt.receipt_digest }));
    const readback = readJson(continuityPath);
    if (!readback || graphDigest(repo) !== currentDigest) throw new Error("continuity_readback_failed");
    return { status: "success", changed: manifestChanged || continuityChanged || projectionChanged, blockers: [], continuity: { ...status(repo, nextManifest, options), ...receipt } };
  } catch (_) {
    atomicWrite(manifestPath, manifestBefore);
    if (continuityBefore) atomicWrite(continuityPath, continuityBefore);
    else if (fs.existsSync(continuityPath)) fs.unlinkSync(continuityPath);
    if (projectionBefore) atomicWrite(projectionPath, projectionBefore);
    else if (fs.existsSync(projectionPath)) fs.unlinkSync(projectionPath);
    return { status: "fail", changed: false, blockers: ["continuity_transaction_failed", "continuity_rollback_applied"] };
  } finally { releaseLock(lease); }
}

function verify(repo, manifest, options = {}) {
  const current = status(repo, manifest, options);
  const blockers = [...current.blockers];
  if (current.policy === "task_boundary" && current.freshness !== "current") blockers.push(`continuity_${current.freshness}`);
  if (options.receiptDigest && current.terminal_receipt?.receipt_digest !== options.receiptDigest) blockers.push("continuity_receipt_digest_mismatch");
  let objects = readObjects(repo);
  if (isCapsule(repo, manifest)) {
    try { objects = require("./capsule-provider").load(repo).records.map((item) => item.object).filter((item) => /^(evidence\.continuity\.|regression_case\.continuity\.|decision\.proposal\.|lesson\.continuity\.)/.test(item.id)); }
    catch (error) { blockers.push(error.message); }
  }
  for (const object of objects) {
    if (!object.id || !object.kind || !object.title || !object.summary || !object.readiness || !object.profile) blockers.push("continuity_object_incomplete");
    if (SECRET_PATTERN.test(JSON.stringify(object)) || PRIVATE_PATH_PATTERN.test(JSON.stringify(object)) || HOST_PATH_PATTERN.test(JSON.stringify(object))) blockers.push("continuity_object_contains_sensitive_or_host_data");
    if (["decision", "goal"].includes(object.kind) && object.readiness === "accepted" && !object.approval_ref && object.id.includes("proposal")) blockers.push("continuity_proposal_promoted_without_approval");
  }
  return { status: blockers.length ? "blocked" : "success", blockers: unique(blockers), continuity: current };
}

module.exports = {
  BOUNDARIES,
  CONTINUITY_FILE,
  CONTEXT_PROJECTION_FILE,
  canonicalBytes,
  continuityPolicy,
  digest,
  graphDigest,
  latestReceipt,
  normalizeEvidence,
  prepareCapsuleContinuity,
  stateRoot,
  status,
  sync,
  verify,
};
