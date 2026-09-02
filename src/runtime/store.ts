import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { canonicalJson, digestValue } from "../core/canonical.js";
import type { MiraiProgram } from "../program/types.js";
import {
  CHECKPOINT_CONTRACT_VERSION,
  RUN_CONTRACT_VERSION,
  type CapabilityGrant,
  type CapabilityRequest,
  type ApprovalReceipt,
  type EffectReceipt,
  type GovernedEpisode,
  type PolicyDecisionRecord,
  type RuntimeCheckpoint,
  type RuntimeRunRecord
} from "./contracts.js";

interface RunIndexEntry {
  run_id: string;
  graph_id: string;
  run_dir: string;
}

export interface LeaseRecord {
  token: string;
  generation: number;
  pid: number;
  acquired_at: string;
  expires_at: string;
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 100);
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error("invalid_runtime_identifier");
  return `${cleaned}.${digestValue(value).slice(7, 15)}`;
}

function ensurePrivateDirectory(directory: string): void {
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error(`runtime_symlink_forbidden:${directory}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writeAtomic(filename: string, value: unknown): void {
  ensurePrivateDirectory(path.dirname(filename));
  if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new Error(`runtime_symlink_forbidden:${filename}`);
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${filename}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  fs.writeFileSync(temporary, body, { mode: 0o600, flag: "wx" });
  fs.renameSync(temporary, filename);
  fs.chmodSync(filename, 0o600);
  if (fs.readFileSync(filename, "utf8") !== body) throw new Error(`runtime_readback_mismatch:${filename}`);
}

function readJson<T>(filename: string): T {
  if (!fs.existsSync(filename)) throw new Error(`runtime_file_missing:${filename}`);
  if (fs.lstatSync(filename).isSymbolicLink()) throw new Error(`runtime_symlink_forbidden:${filename}`);
  return JSON.parse(fs.readFileSync(filename, "utf8")) as T;
}

export class RunStore {
  readonly home: string;
  readonly runsRoot: string;
  readonly indexRoot: string;
  private readonly ownedLeases = new Map<string, { token: string; generation: number }>();
  private readonly mutationLocks = new Map<string, { token: string; depth: number }>();

  constructor(home = process.env.MIRAI_HOME || path.join(os.homedir(), ".mirai"), options: { create?: boolean } = {}) {
    this.home = path.resolve(home);
    this.runsRoot = path.join(this.home, "runs");
    this.indexRoot = path.join(this.home, "run-index");
    if (options.create === false) {
      for (const directory of [this.home, this.runsRoot, this.indexRoot]) {
        if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error(`runtime_symlink_forbidden:${directory}`);
      }
      return;
    }
    ensurePrivateDirectory(this.home);
    ensurePrivateDirectory(this.runsRoot);
    ensurePrivateDirectory(this.indexRoot);
  }

  listRunIds(): string[] {
    if (!fs.existsSync(this.indexRoot)) return [];
    if (fs.lstatSync(this.indexRoot).isSymbolicLink()) throw new Error(`runtime_symlink_forbidden:${this.indexRoot}`);
    return fs.readdirSync(this.indexRoot)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const entry = readJson<RunIndexEntry>(path.join(this.indexRoot, file));
        if (`${safeSegment(entry.run_id)}.json` !== file) throw new Error(`run_index_filename_mismatch:${file}`);
        this.directory(entry.run_id);
        return entry.run_id;
      });
  }

  createRun(options: {
    program: MiraiProgram;
    input: Record<string, unknown>;
    sandbox: string;
    apply: boolean;
    approval_receipt_ref?: string;
    run_id?: string;
    now?: Date;
    runtime_config?: Record<string, unknown>;
  }): RuntimeRunRecord {
    const now = options.now || new Date();
    const runId = options.run_id || `run.${now.toISOString().replace(/[-:.TZ]/g, "")}.${randomBytes(5).toString("hex")}`;
    const graphSegment = safeSegment(options.program.id);
    const runSegment = safeSegment(runId);
    const directory = path.join(this.runsRoot, graphSegment, runSegment);
    if (fs.existsSync(directory)) throw new Error(`run_already_exists:${runId}`);
    ensurePrivateDirectory(directory);
    for (const child of ["capability-requests", "capabilities", "receipts", "policy-decisions", "backups"]) ensurePrivateDirectory(path.join(directory, child));
    const record: RuntimeRunRecord = {
      contract_version: RUN_CONTRACT_VERSION,
      run_id: runId,
      graph_id: options.program.id,
      program_id: options.program.id,
      program_digest: options.program.digest,
      input_digest: digestValue(options.input),
      sandbox: path.resolve(options.sandbox),
      status: "prepared",
      revision: 1,
      event_sequence: 0,
      apply_requested: options.apply,
      ...(options.approval_receipt_ref ? { approval_receipt_ref: options.approval_receipt_ref } : {}),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      blockers: [],
      limitations: ["Runtime state is host-local and does not authorize canonical graph updates."],
      program_ref: "program.json",
      input_ref: "input.json",
      checkpoint_ref: "checkpoint.json"
    };
    writeAtomic(path.join(directory, "program.json"), options.program);
    writeAtomic(path.join(directory, "input.json"), options.input);
    writeAtomic(path.join(directory, "runtime-config.json"), options.runtime_config || {});
    writeAtomic(path.join(directory, "run.json"), record);
    writeAtomic(path.join(this.indexRoot, `${safeSegment(runId)}.json`), { run_id: runId, graph_id: options.program.id, run_dir: directory } satisfies RunIndexEntry);
    this.writeCheckpoint(runId, record);
    return record;
  }

  directory(runId: string): string {
    const index = readJson<RunIndexEntry>(path.join(this.indexRoot, `${safeSegment(runId)}.json`));
    if (index.run_id !== runId) throw new Error("run_index_id_mismatch");
    const directory = path.resolve(index.run_dir);
    if (!directory.startsWith(`${this.runsRoot}${path.sep}`)) throw new Error("run_index_boundary_violation");
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("run_directory_symlink_forbidden");
    return directory;
  }

  readRun(runId: string): RuntimeRunRecord {
    return readJson<RuntimeRunRecord>(path.join(this.directory(runId), "run.json"));
  }

  readProgram(runId: string): MiraiProgram {
    return readJson<MiraiProgram>(path.join(this.directory(runId), "program.json"));
  }

  readInput(runId: string): Record<string, unknown> {
    return readJson<Record<string, unknown>>(path.join(this.directory(runId), "input.json"));
  }

  readRuntimeConfig(runId: string): Record<string, unknown> {
    return readJson<Record<string, unknown>>(path.join(this.directory(runId), "runtime-config.json"));
  }

  private withMutationLock<T>(runId: string, operation: () => T): T {
    const reentrant = this.mutationLocks.get(runId);
    if (reentrant) {
      reentrant.depth += 1;
      try {
        return operation();
      } finally {
        reentrant.depth -= 1;
      }
    }

    const lockDirectory = path.join(this.directory(runId), "mutation.lock");
    if (fs.existsSync(lockDirectory) && fs.lstatSync(lockDirectory).isSymbolicLink()) {
      throw new Error("run_mutation_lock_symlink_forbidden");
    }
    try {
      fs.mkdirSync(lockDirectory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`run_mutation_lock_active:${runId}`);
      throw error;
    }

    const token = randomBytes(24).toString("hex");
    const ownerFile = path.join(lockDirectory, "owner.json");
    fs.writeFileSync(ownerFile, `${JSON.stringify({ token, pid: process.pid, acquired_at: new Date().toISOString() }, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx"
    });
    this.mutationLocks.set(runId, { token, depth: 1 });
    try {
      return operation();
    } finally {
      const owned = this.mutationLocks.get(runId);
      this.mutationLocks.delete(runId);
      if (!owned || owned.token !== token) throw new Error("run_mutation_lock_fenced");
      const owner = readJson<{ token: string }>(ownerFile);
      if (owner.token !== token) throw new Error("run_mutation_lock_fenced");
      fs.unlinkSync(ownerFile);
      fs.rmdirSync(lockDirectory);
    }
  }

  private withFencedMutation<T>(runId: string, operation: () => T): T {
    return this.withMutationLock(runId, () => {
      this.assertWriteFence(runId);
      return operation();
    });
  }

  updateRun(runId: string, expectedRevision: number, update: (record: RuntimeRunRecord) => RuntimeRunRecord): RuntimeRunRecord {
    return this.withMutationLock(runId, () => {
      this.assertWriteFence(runId);
      const current = this.readRun(runId);
      if (current.revision !== expectedRevision) throw new Error(`run_compare_and_swap_failed:${expectedRevision}:${current.revision}`);
      const next = update(structuredClone(current));
      next.revision = current.revision + 1;
      next.updated_at = new Date().toISOString();
      writeAtomic(path.join(this.directory(runId), "run.json"), next);
      return next;
    });
  }

  appendEvent(runId: string, event: Record<string, unknown>): RuntimeRunRecord {
    return this.withMutationLock(runId, () => {
      this.assertWriteFence(runId);
      const current = this.readRun(runId);
      const sequence = current.event_sequence + 1;
      const line = `${canonicalJson({ sequence, recorded_at: new Date().toISOString(), ...event })}\n`;
      const filename = path.join(this.directory(runId), "events.ndjson");
      if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new Error("runtime_events_symlink_forbidden");
      fs.appendFileSync(filename, line, { mode: 0o600 });
      return this.updateRun(runId, current.revision, (record) => ({ ...record, event_sequence: sequence }));
    });
  }

  acquireLease(runId: string, ttlMs = 30_000): LeaseRecord {
    return this.withMutationLock(runId, () => {
      if (!Number.isFinite(ttlMs) || ttlMs < 1) throw new Error("run_lease_ttl_invalid");
      const filename = path.join(this.directory(runId), "lease.json");
      const now = new Date();
      let previousGeneration = 0;
      if (fs.existsSync(filename)) {
        const current = readJson<LeaseRecord>(filename);
        if (Date.parse(current.expires_at) > now.getTime()) throw new Error(`run_lease_active:${runId}`);
        previousGeneration = Number.isSafeInteger(current.generation) && current.generation >= 0 ? current.generation : 0;
        fs.unlinkSync(filename);
      }
      const lease: LeaseRecord = {
        token: randomBytes(24).toString("hex"),
        generation: previousGeneration + 1,
        pid: process.pid,
        acquired_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlMs).toISOString()
      };
      fs.writeFileSync(filename, `${JSON.stringify(lease, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      this.ownedLeases.set(runId, { token: lease.token, generation: lease.generation });
      return lease;
    });
  }

  renewLease(runId: string, token: string, ttlMs = 30_000): LeaseRecord {
    return this.withMutationLock(runId, () => {
      if (!Number.isFinite(ttlMs) || ttlMs < 1) throw new Error("run_lease_ttl_invalid");
      const filename = path.join(this.directory(runId), "lease.json");
      const current = readJson<LeaseRecord>(filename);
      const owned = this.ownedLeases.get(runId);
      if (!owned || owned.token !== token || current.token !== token || current.generation !== owned.generation) throw new Error("run_lease_fenced");
      const now = new Date();
      if (Date.parse(current.expires_at) <= now.getTime()) throw new Error("run_lease_expired");
      const renewed: LeaseRecord = { ...current, expires_at: new Date(now.getTime() + ttlMs).toISOString() };
      writeAtomic(filename, renewed);
      return renewed;
    });
  }

  assertLeaseOwnership(runId: string, token: string): void {
    const filename = path.join(this.directory(runId), "lease.json");
    const current = readJson<LeaseRecord>(filename);
    const owned = this.ownedLeases.get(runId);
    if (!owned || owned.token !== token || current.token !== token || current.generation !== owned.generation) throw new Error("run_lease_fenced");
    if (Date.parse(current.expires_at) <= Date.now()) throw new Error("run_lease_expired");
  }

  private assertWriteFence(runId: string): void {
    const filename = path.join(this.directory(runId), "lease.json");
    if (!fs.existsSync(filename)) return;
    const owned = this.ownedLeases.get(runId);
    if (!owned) throw new Error("run_lease_fenced");
    this.assertLeaseOwnership(runId, owned.token);
  }

  releaseLease(runId: string, token: string): void {
    this.withMutationLock(runId, () => {
      const filename = path.join(this.directory(runId), "lease.json");
      if (!fs.existsSync(filename)) return;
      const lease = readJson<LeaseRecord>(filename);
      const owned = this.ownedLeases.get(runId);
      if (!owned || lease.token !== token || lease.generation !== owned.generation) throw new Error("run_lease_fenced");
      fs.unlinkSync(filename);
      this.ownedLeases.delete(runId);
    });
  }

  writeCapability(runId: string, grant: CapabilityGrant): string {
    return this.withFencedMutation(runId, () => {
      const ref = `capabilities/${safeSegment(grant.grant_id)}.json`;
      writeAtomic(path.join(this.directory(runId), ref), grant);
      return ref;
    });
  }

  writeCapabilityRequest(runId: string, request: CapabilityRequest): string {
    return this.withFencedMutation(runId, () => {
      const ref = `capability-requests/${safeSegment(request.request_id)}.json`;
      writeAtomic(path.join(this.directory(runId), ref), request);
      return ref;
    });
  }

  writeApproval(runId: string, approval: ApprovalReceipt): string {
    return this.withFencedMutation(runId, () => {
      const ref = "approval.json";
      writeAtomic(path.join(this.directory(runId), ref), approval);
      return ref;
    });
  }

  readApproval(runId: string): ApprovalReceipt | undefined {
    const filename = path.join(this.directory(runId), "approval.json");
    return fs.existsSync(filename) ? readJson<ApprovalReceipt>(filename) : undefined;
  }

  writePolicyDecision(runId: string, decision: PolicyDecisionRecord): string {
    return this.withFencedMutation(runId, () => {
      const ref = `policy-decisions/${safeSegment(decision.decision_id)}.json`;
      writeAtomic(path.join(this.directory(runId), ref), decision);
      return ref;
    });
  }

  listPolicyDecisionRefs(runId: string): string[] {
    const directory = path.join(this.directory(runId), "policy-decisions");
    return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => `policy-decisions/${file}`);
  }

  writeReceipt(runId: string, receipt: EffectReceipt): string {
    return this.withFencedMutation(runId, () => {
      const ref = `receipts/${safeSegment(receipt.receipt_id)}.json`;
      writeAtomic(path.join(this.directory(runId), ref), receipt);
      return ref;
    });
  }

  readReceipt(runId: string, receiptId: string): EffectReceipt | undefined {
    const filename = path.join(this.directory(runId), "receipts", `${safeSegment(receiptId)}.json`);
    return fs.existsSync(filename) ? readJson<EffectReceipt>(filename) : undefined;
  }

  listReceipts(runId: string): EffectReceipt[] {
    const directory = path.join(this.directory(runId), "receipts");
    return fs.readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<EffectReceipt>(path.join(directory, file)))
      .sort((left, right) => (left.sequence || 0) - (right.sequence || 0) || left.receipt_id.localeCompare(right.receipt_id));
  }

  writeCheckpoint(runId: string, run = this.readRun(runId)): RuntimeCheckpoint {
    return this.withFencedMutation(runId, () => {
      const receipts = this.listReceipts(runId);
      const checkpoint: RuntimeCheckpoint = {
        contract_version: CHECKPOINT_CONTRACT_VERSION,
        run_id: runId,
        revision: run.revision,
        status: run.status,
        event_sequence: run.event_sequence,
        verified_receipt_ids: receipts.filter((item) => item.status === "verified" || item.status === "compensated").map((item) => item.receipt_id).sort(),
        uncertain_receipt_ids: receipts.filter((item) => item.status === "uncertain" || item.status === "prepared" || item.status === "executed").map((item) => item.receipt_id).sort(),
        updated_at: new Date().toISOString(),
        resume_strategy: "deterministic_restart_with_receipt_deduplication"
      };
      writeAtomic(path.join(this.directory(runId), "checkpoint.json"), checkpoint);
      return checkpoint;
    });
  }

  readCheckpoint(runId: string): RuntimeCheckpoint {
    return readJson<RuntimeCheckpoint>(path.join(this.directory(runId), "checkpoint.json"));
  }

  writeEpisode(runId: string, episode: GovernedEpisode): void {
    this.withFencedMutation(runId, () => writeAtomic(path.join(this.directory(runId), "episode.json"), episode));
  }

  readEpisode(runId: string): GovernedEpisode {
    return readJson<GovernedEpisode>(path.join(this.directory(runId), "episode.json"));
  }

  writeBackup(runId: string, idempotencyKey: string, value: unknown): string {
    return this.withFencedMutation(runId, () => {
      const ref = `backups/${safeSegment(idempotencyKey)}.json`;
      writeAtomic(path.join(this.directory(runId), ref), value);
      return ref;
    });
  }

  readArtifact<T>(runId: string, ref: string): T {
    const directory = this.directory(runId);
    const target = path.resolve(directory, ref);
    if (!target.startsWith(`${directory}${path.sep}`)) throw new Error("runtime_artifact_boundary_violation");
    return readJson<T>(target);
  }
}
