import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { digestValue, sha256 } from "../core/canonical.js";
import { createLegacyFacade, createProjectLock, generateProjectStart, validateProjectCapsule, LOCK_PATH, MANIFEST_PATH } from "./capsule.js";
import { assertNoPendingProjectUpdate, PROJECT_UPDATE_PENDING, projectUpdatePath } from "./transaction-boundary.js";

type Image = Record<string, string>;
export interface ProjectUpdateProposal {
  contract_version: "1.0.0";
  project_id: string;
  project_binding: string;
  base_lock_digest: string;
  result_lock_digest: string;
  before: Image;
  after: Image;
  changes: Record<string, string>;
  context: Record<string, unknown>;
  canonical_write_allowed: false;
  digest: string;
}
export interface ProjectUpdateApproval {
  approval_id: string;
  proposal_digest: string;
  project_binding: string;
  action: "apply" | "rollback";
  expires_at: string;
}
export interface ProjectUpdateHost {
  // Injected by trusted host code, never deserialized from graph or CLI input.
  verify_approval: (request: Readonly<{ proposal_digest: string; project_binding: string; project_id: string; action: "apply" | "rollback" }>) => ProjectUpdateApproval | null;
  on_checkpoint?: (point: string) => void;
}
export interface ProjectUpdateReceipt {
  contract_version: "1.0.0";
  proposal_digest: string;
  project_binding: string;
  approval_id: string;
  outcome: "committed" | "rolled_back";
  image_digest: string;
  digest: string;
}
const STORE = ".mirai/project-updates";
const LEASE = ".mirai/project-update.lease.json";
const RECLAIM = ".mirai/project-update.reclaim.json";
const LIMIT = 16 * 1024 * 1024;
const FILE_LIMIT = 2000;
const HASH = /^sha256:[0-9a-f]{64}$/;
const bytes = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const binding = (root: string): string => sha256(Buffer.from(fs.realpathSync(root)));
const filename = (root: string, ref: string): string => projectUpdatePath(root, ref);

function syncDirectory(dir: string): void {
  if (process.platform === "win32") return;
  const fd = fs.openSync(dir, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function ensureDirectory(root: string, ref: string): void {
  if (!ref || ref === ".") return;
  const parts = ref.split("/");
  for (let i = 1; i <= parts.length; i += 1) {
    const dir = filename(root, parts.slice(0, i).join("/"));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { mode: 0o700 });
      syncDirectory(path.dirname(dir));
    }
  }
}

function atomicWrite(root: string, ref: string, content: Buffer, mode = 0o600): void {
  const target = filename(root, ref);
  ensureDirectory(root, path.posix.dirname(ref));
  const temporary = `${target}.tmp-${randomUUID()}`;
  const fd = fs.openSync(temporary, "wx", mode);
  try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try {
    filename(root, ref);
    fs.renameSync(temporary, target);
    syncDirectory(path.dirname(target));
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  if (!fs.readFileSync(filename(root, ref)).equals(content)) throw new Error("project_update_readback_failed");
}

function writeJson(root: string, ref: string, value: unknown): void { atomicWrite(root, ref, Buffer.from(bytes(value))); }
function remove(root: string, ref: string): void {
  const target = filename(root, ref);
  if (fs.existsSync(target)) { fs.unlinkSync(target); syncDirectory(path.dirname(target)); }
}

function image(root: string): Image {
  const result: Image = {};
  let size = 0;
  let count = 0;
  const walk = (ref: string, depth = 0): void => {
    if (++count > FILE_LIMIT || depth > 32) throw new Error("project_update_snapshot_budget");
    const target = filename(root, ref);
    if (!fs.existsSync(target)) return;
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) {
      const dir = fs.opendirSync(target);
      const names: string[] = [];
      try {
        let entry;
        while ((entry = dir.readSync())) {
          if (names.length + count >= FILE_LIMIT) throw new Error("project_update_snapshot_budget");
          names.push(entry.name);
        }
      } finally { dir.closeSync(); }
      for (const item of names.sort()) walk(`${ref}/${item}`, depth + 1);
    }
    else {
      if (!stat.isFile() || stat.nlink !== 1) throw new Error("project_update_nonregular_file");
      size += stat.size;
      if (size > LIMIT) throw new Error("project_update_snapshot_budget");
      result[ref] = fs.readFileSync(target).toString("base64");
    }
  };
  walk("mirai");
  walk("graph.json");
  return result;
}

function assertImage(value: Image): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > FILE_LIMIT) throw new Error("project_update_image_invalid");
  let size = 0;
  for (const [ref, content] of Object.entries(value)) {
    if (!(ref === "graph.json" || ref.startsWith("mirai/")) || ref.includes("\\") || ref.split("/").some((p) => !p || p === "." || p === "..")) throw new Error("project_update_image_path_invalid");
    if (typeof content !== "string" || (size += content.length) > Math.ceil(LIMIT * 4 / 3) + FILE_LIMIT * 4) throw new Error("project_update_snapshot_budget");
    if (Buffer.from(content, "base64").toString("base64") !== content) throw new Error("project_update_image_encoding_invalid");
  }
}

function inStage<T>(input: Image, callback: (root: string) => T): T {
  assertImage(input);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-project-update-"));
  try {
    for (const [ref, content] of Object.entries(input)) {
      const target = filename(root, ref);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, Buffer.from(content, "base64"), { mode: 0o600 });
    }
    return callback(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function assemble(root: string, changes: Record<string, string>, context: Record<string, unknown>, projectBinding: string): ProjectUpdateProposal {
  const before = image(root);
  const validation = validateProjectCapsule(root);
  if (!validation.valid || !validation.lock) throw new Error(`project_update_invalid_capsule:${validation.errors.join(",")}`);
  const manifest = validation.lock.manifest;
  const refs = [manifest.entrypoints.graph.root, ...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations,
    manifest.entrypoints.sources, manifest.documentation.start, manifest.documentation.owner_notes,
    ...["programs", "components", "policies", "interfaces", "context"].map((key) => manifest.entrypoints[key as keyof typeof manifest.entrypoints]).filter((v): v is string => typeof v === "string")];
  if (refs.some((ref) => !ref.startsWith("mirai/"))) throw new Error("project_update_external_entrypoint_unsupported");
  if (manifest.compatibility.legacy_facade === "required_2_x" && before["graph.json"]) {
    const actual = JSON.parse(Buffer.from(before["graph.json"], "base64").toString("utf8"));
    const expected = createLegacyFacade(manifest, actual);
    for (const key of ["id", "owner", "profiles", "graph"]) {
      if (digestValue(actual[key]) !== digestValue(expected[key])) throw new Error("project_update_facade_mismatch");
    }
  }
  const declared = new Set([...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations]);
  const protectedRefs = [MANIFEST_PATH, LOCK_PATH, manifest.documentation.start, manifest.documentation.owner_notes, manifest.entrypoints.sources,
    manifest.entrypoints.programs, manifest.entrypoints.components, manifest.entrypoints.policies, manifest.entrypoints.interfaces, manifest.entrypoints.context].filter((v): v is string => typeof v === "string");
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length) throw new Error("project_update_changes_missing");
  for (const [ref, content] of Object.entries(changes)) {
    if (!declared.has(ref) || !ref.startsWith(`${manifest.entrypoints.graph.root}/`) || !ref.endsWith(".json") || !Object.hasOwn(before, ref)
      || protectedRefs.some((p) => p === ref || ref.startsWith(`${p}/`))) throw new Error("project_update_change_outside_graph_contract");
    if (typeof content !== "string" || Buffer.byteLength(content) > LIMIT) throw new Error("project_update_change_budget");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) && (!parsed || typeof parsed !== "object")) throw new Error("project_update_graph_json_invalid");
  }
  if (Buffer.byteLength(JSON.stringify(context)) > 65536) throw new Error("project_update_context_budget");
  const after = inStage(before, (stage) => {
    for (const [ref, content] of Object.entries(changes)) fs.writeFileSync(filename(stage, ref), content);
    const ids = new Set<string>();
    for (const ref of manifest.entrypoints.graph.objects) {
      const input = JSON.parse(fs.readFileSync(filename(stage, ref), "utf8"));
      for (const object of Array.isArray(input) ? input : [input]) {
        if (!object || typeof object.id !== "string" || !object.id || ids.has(object.id)) throw new Error("project_update_graph_identity_invalid");
        ids.add(object.id);
      }
    }
    const lock = createProjectLock(stage);
    const noteBytes = before[manifest.documentation.owner_notes];
    const notes = noteBytes ? Buffer.from(noteBytes, "base64").toString("utf8").replaceAll("\r\n", "\n") : "";
    fs.writeFileSync(filename(stage, LOCK_PATH), bytes(lock));
    fs.writeFileSync(filename(stage, manifest.documentation.start), generateProjectStart(lock, notes));
    if (manifest.compatibility.legacy_facade === "required_2_x") {
      const legacy = before["graph.json"] ? JSON.parse(Buffer.from(before["graph.json"], "base64").toString("utf8")) : undefined;
      fs.writeFileSync(filename(stage, "graph.json"), bytes(createLegacyFacade(manifest, legacy)));
    }
    const check = validateProjectCapsule(stage);
    if (!check.valid) throw new Error(`project_update_staging_invalid:${check.errors.join(",")}`);
    return image(stage);
  });
  const body = {
    contract_version: "1.0.0" as const, project_id: manifest.project.id, project_binding: projectBinding,
    base_lock_digest: validation.lock.digest,
    result_lock_digest: JSON.parse(Buffer.from(after[LOCK_PATH]!, "base64").toString("utf8")).digest as string,
    before, after, changes, context, canonical_write_allowed: false as const
  };
  return { ...body, digest: digestValue(body) };
}

/** Preparation writes only a bounded disposable staging directory, never the project. */
export function prepareProjectUpdate(root: string, changes: Record<string, string>, context: Record<string, unknown> = {}): ProjectUpdateProposal {
  assertNoPendingProjectUpdate(root);
  const proposal = assemble(root, changes, context, binding(root));
  assertNoPendingProjectUpdate(root);
  if (digestValue(image(root)) !== digestValue(proposal.before)) throw new Error("project_update_cas_conflict");
  return JSON.parse(JSON.stringify(proposal)) as ProjectUpdateProposal;
}

function validateProposal(root: string, value: ProjectUpdateProposal): ProjectUpdateProposal {
  // Detach caller-owned references before calling host code.
  const proposal = JSON.parse(JSON.stringify(value)) as ProjectUpdateProposal;
  const { digest, ...body } = proposal;
  if (!HASH.test(digest) || digestValue(body) !== digest || proposal.project_binding !== binding(root)) throw new Error("project_update_proposal_integrity");
  assertImage(proposal.before); assertImage(proposal.after);
  const regenerated = inStage(proposal.before, (stage) => assemble(stage, proposal.changes, proposal.context, proposal.project_binding));
  if (regenerated.digest !== digest) throw new Error("project_update_proposal_recomputation");
  return proposal;
}

/** Structural/recomputation validation only; it grants no authority. */
export function validateProjectUpdateProposal(root: string, value: ProjectUpdateProposal): ProjectUpdateProposal {
  return validateProposal(root, value);
}

function authorize(proposal: ProjectUpdateProposal, host: ProjectUpdateHost, action: "apply" | "rollback"): ProjectUpdateApproval {
  if (!host || typeof host.verify_approval !== "function") throw new Error("project_update_host_approval_required");
  const request = Object.freeze({ proposal_digest: proposal.digest, project_binding: proposal.project_binding, project_id: proposal.project_id, action });
  const approval = host.verify_approval(request);
  if (!approval || typeof approval.approval_id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(approval.approval_id)
    || approval.proposal_digest !== proposal.digest || approval.project_binding !== proposal.project_binding || approval.action !== action
    || !Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) <= Date.now()) throw new Error("project_update_approval_denied");
  return { ...approval };
}

function acquire(root: string, recover: boolean, reclaimToken?: string): () => void {
  const assertReclaimOwner = (): void => {
    const claim = filename(root, RECLAIM);
    if (fs.existsSync(claim) && (!reclaimToken || JSON.parse(fs.readFileSync(claim, "utf8")).token !== reclaimToken)) throw new Error("project_update_reclaim_in_progress");
  };
  assertReclaimOwner();
  const target = filename(root, LEASE);
  ensureDirectory(root, path.posix.dirname(LEASE));
  const token = randomUUID();
  const record = { token, pid: process.pid };
  try {
    const fd = fs.openSync(target, "wx", 0o600);
    try { fs.writeFileSync(fd, bytes(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    syncDirectory(path.dirname(target));
    try { assertReclaimOwner(); } catch (error) { remove(root, LEASE); throw error; }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !recover) throw new Error("project_update_lease_unavailable");
    // Serialize reclaimers before inspecting/removing an old lease. An orphaned
    // reclaim guard needs operator inspection; it is never automatically stolen.
    const claimToken = randomUUID();
    const claim = filename(root, RECLAIM);
    const fd = fs.openSync(claim, "wx", 0o600);
    try { fs.writeFileSync(fd, bytes({ token: claimToken, pid: process.pid })); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try {
      const staleText = fs.readFileSync(target, "utf8");
      const stale = JSON.parse(staleText) as { token: string; pid: number };
      if (!Number.isSafeInteger(stale.pid) || stale.pid < 1 || typeof stale.token !== "string") throw new Error("project_update_lease_invalid");
      try { process.kill(stale.pid, 0); throw new Error("project_update_lease_alive"); }
      catch (cause) { if ((cause as NodeJS.ErrnoException).code !== "ESRCH") throw cause; }
      const quarantine = `${target}.stale-${randomUUID()}`;
      fs.renameSync(target, quarantine);
      if (fs.readFileSync(quarantine, "utf8") !== staleText) throw new Error("project_update_lease_race");
      return acquire(root, false, claimToken);
    } finally { remove(root, RECLAIM); }
  }
  return () => {
    const current = JSON.parse(fs.readFileSync(filename(root, LEASE), "utf8"));
    if (current.token !== token) throw new Error("project_update_lease_ownership_lost");
    remove(root, LEASE);
  };
}

function refFor(proposal: ProjectUpdateProposal, suffix: string): string { return `${STORE}/${proposal.digest.slice(7)}.${suffix}.json`; }
function readJson(root: string, ref: string): any { // Persistence is validated below before use.
  const file = filename(root, ref);
  if (fs.statSync(file).size > LIMIT * 8) throw new Error("project_update_journal_budget");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function assertCurrent(root: string, expected: Image): void {
  if (digestValue(image(root)) !== digestValue(expected)) throw new Error("project_update_cas_conflict");
}
function checkpoint(host: ProjectUpdateHost, point: string): void { host.on_checkpoint?.(point); }

function persistReceipt(root: string, proposal: ProjectUpdateProposal, approval: ProjectUpdateApproval, outcome: ProjectUpdateReceipt["outcome"]): ProjectUpdateReceipt {
  const body = { contract_version: "1.0.0" as const, proposal_digest: proposal.digest, project_binding: proposal.project_binding,
    approval_id: approval.approval_id, outcome, image_digest: digestValue(outcome === "committed" ? proposal.after : proposal.before) };
  const receipt = { ...body, digest: digestValue(body) };
  writeJson(root, refFor(proposal, "receipt"), receipt);
  return receipt;
}

function priorReceipt(root: string, proposal: ProjectUpdateProposal): ProjectUpdateReceipt | undefined {
  const ref = refFor(proposal, "receipt");
  if (!fs.existsSync(filename(root, ref))) return;
  const receipt = readJson(root, ref) as ProjectUpdateReceipt;
  const { digest, ...body } = receipt;
  if (digestValue(body) !== digest || receipt.proposal_digest !== proposal.digest || receipt.project_binding !== proposal.project_binding
    || !["committed", "rolled_back"].includes(receipt.outcome)
    || receipt.image_digest !== digestValue(receipt.outcome === "committed" ? proposal.after : proposal.before)) throw new Error("project_update_receipt_invalid");
  assertCurrent(root, receipt.outcome === "committed" ? proposal.after : proposal.before);
  return receipt;
}

function transition(root: string, proposal: ProjectUpdateProposal, approval: ProjectUpdateApproval, host: ProjectUpdateHost, rollback: boolean): ProjectUpdateReceipt {
  const targetImage = rollback ? proposal.before : proposal.after;
  const current = image(root);
  const refs = [...new Set([...Object.keys(proposal.before), ...Object.keys(proposal.after)])].sort();
  if (Object.keys(current).some((ref) => !refs.includes(ref))) throw new Error("project_update_recovery_conflict");
  for (const ref of refs) if (current[ref] !== proposal.before[ref] && current[ref] !== proposal.after[ref]) throw new Error("project_update_recovery_conflict");
  for (const ref of refs) {
    if (current[ref] === targetImage[ref]) continue;
    checkpoint(host, `before_write:${ref}`);
    assertCurrent(root, current);
    authorize(proposal, host, rollback ? "rollback" : "apply");
    if (targetImage[ref] === undefined) remove(root, ref);
    else {
      const target = filename(root, ref);
      const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o644;
      atomicWrite(root, ref, Buffer.from(targetImage[ref], "base64"), mode);
    }
    if (targetImage[ref] === undefined) delete current[ref]; else current[ref] = targetImage[ref];
    checkpoint(host, `after_write:${ref}`);
  }
  assertCurrent(root, targetImage);
  checkpoint(host, "before_receipt");
  assertCurrent(root, targetImage);
  authorize(proposal, host, rollback ? "rollback" : "apply");
  const receipt = persistReceipt(root, proposal, approval, rollback ? "rolled_back" : "committed");
  checkpoint(host, "after_receipt");
  assertCurrent(root, targetImage);
  remove(root, PROJECT_UPDATE_PENDING);
  return receipt;
}

export function applyProjectUpdate(root: string, value: ProjectUpdateProposal, host: ProjectUpdateHost): { changed: boolean; receipt: ProjectUpdateReceipt } {
  const proposal = validateProposal(root, value);
  const approval = authorize(proposal, host, "apply");
  assertNoPendingProjectUpdate(root);
  const existing = priorReceipt(root, proposal);
  if (existing) {
    if (existing.outcome !== "committed") throw new Error("project_update_previously_rolled_back");
    return { changed: false, receipt: existing };
  }
  assertCurrent(root, proposal.before);
  const release = acquire(root, false);
  try {
    assertNoPendingProjectUpdate(root);
    assertCurrent(root, proposal.before);
    checkpoint(host, "before_journal");
    writeJson(root, refFor(proposal, "journal"), proposal);
    checkpoint(host, "after_journal");
    writeJson(root, PROJECT_UPDATE_PENDING, { proposal_digest: proposal.digest });
    checkpoint(host, "after_pending");
    assertCurrent(root, proposal.before);
    return { changed: true, receipt: transition(root, proposal, approval, host, false) };
  } finally { release(); }
}

/** Explicit recovery re-verifies current host authority and every before/after hash. */
export function recoverProjectUpdate(root: string, proposalDigest: string, action: "apply" | "rollback", host: ProjectUpdateHost): { changed: boolean; receipt: ProjectUpdateReceipt } {
  if (!HASH.test(proposalDigest) || !["apply", "rollback"].includes(action)) throw new Error("project_update_recovery_request_invalid");
  const proposal = validateProposal(root, readJson(root, `${STORE}/${proposalDigest.slice(7)}.journal.json`));
  if (proposal.digest !== proposalDigest) throw new Error("project_update_journal_identity_mismatch");
  const approval = authorize(proposal, host, action);
  const release = acquire(root, true);
  try {
    const pending = filename(root, PROJECT_UPDATE_PENDING);
    if (!fs.existsSync(pending)) {
      const receipt = priorReceipt(root, proposal);
      if (!receipt) throw new Error("project_update_recovery_not_pending");
      return { changed: false, receipt };
    }
    if (readJson(root, PROJECT_UPDATE_PENDING).proposal_digest !== proposalDigest) throw new Error("project_update_pending_mismatch");
    const receipt = priorReceipt(root, proposal);
    if (receipt) {
      remove(root, PROJECT_UPDATE_PENDING);
      return { changed: false, receipt };
    }
    return { changed: true, receipt: transition(root, proposal, approval, host, action === "rollback") };
  } finally { release(); }
}
