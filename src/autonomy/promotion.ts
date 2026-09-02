import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, digestValue, withoutDigest } from "../core/canonical.js";
import { resolveConfinedPath } from "../core/path-boundary.js";
import { evaluateEvolutionProposal, validateAutonomyEnvelope, validateEvolutionProposal } from "./evaluator.js";
import {
  PROMOTION_RECEIPT_CONTRACT_VERSION,
  type AdaptiveState,
  type AdaptiveChangeKind,
  type AutonomyEnvelope,
  type EvolutionDecision,
  type EvolutionProposal,
  type PromotionReceipt
} from "./types.js";

const STATE_REF = /^\.mirai\/adaptive\/[A-Za-z0-9._/-]+\.json$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

interface PromotionJournal {
  contract_version: "1.0.0";
  id: string;
  proposal_id: string;
  proposal_digest: string;
  decision_digest: string;
  envelope_digest: string;
  state_ref: string;
  before_digest: string;
  after_digest: string;
  revision: number;
  rollback_ref: string;
  applied_change_ids: string[];
  applied_at: string;
  status: "prepared";
  canonical_write_allowed: false;
  digest: string;
}

interface LeaseRecord {
  contract_version: "1.0.0";
  token: string;
  pid: number;
  created_at: string;
}

function assertStateRef(reference: string): void {
  if (!STATE_REF.test(reference) || reference.split("/").some((part) => part === "." || part === "..")) throw new Error("adaptive_state_ref_invalid");
}

function emptyState(scope: string): AdaptiveState {
  const candidate = { contract_version: "1.0.0" as const, scope, revision: 0, records: {}, applied_proposal_ids: [] as string[] };
  return { ...candidate, digest: digestValue(candidate) };
}

function readState(filename: string, scope: string): AdaptiveState {
  if (!fs.existsSync(filename)) return emptyState(scope);
  const state = JSON.parse(fs.readFileSync(filename, "utf8")) as AdaptiveState;
  if (state.scope !== scope || digestValue(withoutDigest(state as unknown as Record<string, unknown>)) !== state.digest) throw new Error("adaptive_state_invalid");
  if (!Array.isArray(state.applied_proposal_ids) || (state.applied_proposal_digests && typeof state.applied_proposal_digests !== "object")) throw new Error("adaptive_state_invalid");
  return state;
}

function atomicJson(filename: string, value: unknown): void {
  const directory = path.dirname(filename);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, filename);
    if (process.platform !== "win32") {
      const directoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY);
      try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }
    }
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* Preserve the original write failure. */ }
    throw error;
  }
  const readback = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (digestValue(readback) !== digestValue(value)) throw new Error("adaptive_state_readback_mismatch");
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function quarantineStaleLease(filename: string): string | undefined {
  let record: LeaseRecord;
  try {
    record = JSON.parse(fs.readFileSync(filename, "utf8")) as LeaseRecord;
  } catch {
    return undefined;
  }
  if (record.contract_version !== "1.0.0" || typeof record.token !== "string" || !record.token || !Number.isSafeInteger(record.pid) || !Number.isFinite(Date.parse(record.created_at))) return undefined;
  if (processIsAlive(record.pid)) return undefined;
  const quarantined = `${filename}.stale-${randomUUID()}`;
  try {
    fs.renameSync(filename, quarantined);
    return quarantined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function acquireLease(filename: string): { filename: string; token: string } {
  const lease = `${filename}.lease`;
  const token = randomUUID();
  const record: LeaseRecord = { contract_version: "1.0.0", token, pid: process.pid, created_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  let quarantined: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(lease, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(record)}\n`, "utf8");
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      if (quarantined) fs.rmSync(quarantined, { force: true });
      return { filename: lease, token };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt > 0 || !(quarantined = quarantineStaleLease(lease))) throw new Error("adaptive_state_lease_unavailable");
    }
  }
  throw new Error("adaptive_state_lease_unavailable");
}

function releaseLease(lease: { filename: string; token: string } | undefined): void {
  if (!lease || !fs.existsSync(lease.filename)) return;
  let record: LeaseRecord;
  try { record = JSON.parse(fs.readFileSync(lease.filename, "utf8")) as LeaseRecord; } catch { throw new Error("adaptive_state_lease_ownership_lost"); }
  if (record.token !== lease.token || record.pid !== process.pid) throw new Error("adaptive_state_lease_ownership_lost");
  fs.unlinkSync(lease.filename);
}

function assertPromotionIntegrity(proposal: EvolutionProposal, decision: EvolutionDecision, envelope: AutonomyEnvelope): void {
  const envelopeErrors = validateAutonomyEnvelope(envelope, new Date().toISOString());
  const proposalErrors = validateEvolutionProposal(proposal);
  if (envelopeErrors.length) throw new Error(`autonomy_envelope_invalid:${envelopeErrors.join(",")}`);
  if (proposalErrors.length) throw new Error(`evolution_proposal_invalid:${proposalErrors.join(",")}`);
  if (!SAFE_ID.test(proposal.id)) throw new Error("evolution_proposal_identity_invalid");
  if (digestValue(withoutDigest(decision as unknown as Record<string, unknown>)) !== decision.digest) throw new Error("evolution_decision_digest_mismatch");
  const expected = evaluateEvolutionProposal(proposal, envelope, decision.evaluated_at);
  if (canonicalJson(expected) !== canonicalJson(decision)) throw new Error("evolution_decision_recomputation_mismatch");
  if (decision.verdict !== "automatic_promotion_allowed" || decision.change_decisions.length !== proposal.changes.length || decision.change_decisions.some((item) => item.verdict !== "allow_automatic")) throw new Error("automatic_promotion_not_allowed");
}

function rollbackLocation(root: string, reference: string): string {
  const prefix = ".mirai/migration-backups/autonomic/";
  if (!reference.startsWith(prefix)) throw new Error("adaptive_rollback_ref_invalid");
  const relative = reference.slice(prefix.length);
  if (!relative || relative.split("/").some((part) => part === "." || part === "..")) throw new Error("adaptive_rollback_ref_invalid");
  const directory = resolveConfinedPath(root, prefix.slice(0, -1), { allow_missing: true, label: "adaptive_rollback" });
  fs.mkdirSync(directory, { recursive: true });
  return resolveConfinedPath(directory, relative, { allow_missing: true, label: "adaptive_rollback" });
}

function persistReceipt(root: string, candidate: Omit<PromotionReceipt, "digest">): PromotionReceipt {
  const receipt: PromotionReceipt = { ...candidate, digest: digestValue(candidate) };
  const reference = `.mirai/evidence/autonomic/${receipt.id}.${receipt.digest.slice(7, 19)}.json`;
  const filename = resolveConfinedPath(root, reference, { allow_missing: true, label: "promotion_receipt" });
  if (fs.existsSync(filename)) {
    const existing = JSON.parse(fs.readFileSync(filename, "utf8"));
    if (canonicalJson(existing) !== canonicalJson(receipt)) throw new Error("promotion_receipt_persistence_conflict");
  } else atomicJson(filename, receipt);
  return receipt;
}

function rollbackReference(proposal: EvolutionProposal): string {
  return `.mirai/migration-backups/autonomic/${proposal.id}.${proposal.digest.slice(7, 19)}.json`;
}

function buildAdaptiveState(before: AdaptiveState, proposal: EvolutionProposal): AdaptiveState {
  const records = { ...before.records };
  for (const change of proposal.changes) {
    records[change.target_ref] = {
      kind: change.kind as AdaptiveChangeKind,
      lifecycle: change.operation === "deprecate" ? "deprecated" : "active",
      payload: change.payload,
      payload_digest: change.payload_digest,
      proposal_ref: proposal.id,
      evidence_refs: change.evidence_refs
    } as typeof records[string];
  }
  const body = {
    contract_version: "1.0.0" as const,
    scope: before.scope,
    revision: before.revision + 1,
    records,
    applied_proposal_ids: [...before.applied_proposal_ids, proposal.id].sort(),
    applied_proposal_digests: { ...(before.applied_proposal_digests || {}), [proposal.id]: proposal.digest }
  };
  return { ...body, digest: digestValue(body) };
}

function persistPromotionJournal(root: string, candidate: Omit<PromotionJournal, "digest">): PromotionJournal {
  const journal: PromotionJournal = { ...candidate, digest: digestValue(candidate) };
  const reference = `.mirai/evidence/autonomic/transactions/${candidate.proposal_id}.${candidate.proposal_digest.slice(7, 19)}.json`;
  const filename = resolveConfinedPath(root, reference, { allow_missing: true, label: "promotion_journal" });
  if (fs.existsSync(filename)) {
    const existing = JSON.parse(fs.readFileSync(filename, "utf8")) as PromotionJournal;
    if (digestValue(withoutDigest(existing as unknown as Record<string, unknown>)) !== existing.digest) throw new Error("promotion_journal_persistence_conflict");
    const expected = { ...candidate, applied_at: existing.applied_at };
    const expectedJournal: PromotionJournal = { ...expected, digest: digestValue(expected) };
    if (canonicalJson(existing) !== canonicalJson(expectedJournal)) throw new Error("promotion_journal_persistence_conflict");
    return existing;
  } else atomicJson(filename, journal);
  return journal;
}

function preparePromotionJournal(root: string, options: {
  proposal: EvolutionProposal;
  decision: EvolutionDecision;
  envelope: AutonomyEnvelope;
  state_ref: string;
  before: AdaptiveState;
  after: AdaptiveState;
  rollback_ref: string;
  applied_at: string;
}): PromotionJournal {
  return persistPromotionJournal(root, {
    contract_version: "1.0.0",
    id: `promotion-journal.${options.proposal.id}`,
    proposal_id: options.proposal.id,
    proposal_digest: options.proposal.digest,
    decision_digest: options.decision.digest,
    envelope_digest: options.envelope.digest,
    state_ref: options.state_ref,
    before_digest: options.before.digest,
    after_digest: options.after.digest,
    revision: options.after.revision,
    rollback_ref: options.rollback_ref,
    applied_change_ids: options.proposal.changes.map((item) => item.id).sort(),
    applied_at: options.applied_at,
    status: "prepared",
    canonical_write_allowed: false
  });
}

export function applyAdaptiveEvolution(options: {
  root: string;
  state_ref: string;
  proposal: EvolutionProposal;
  decision: EvolutionDecision;
  envelope: AutonomyEnvelope;
  authorization_ref: string;
  verify_authorization: (authorizationRef: string, envelope: AutonomyEnvelope) => boolean;
  applied_at: string;
}): PromotionReceipt {
  assertStateRef(options.state_ref);
  assertPromotionIntegrity(options.proposal, options.decision, options.envelope);
  if (!options.authorization_ref || !options.verify_authorization(options.authorization_ref, options.envelope)) throw new Error("autonomy_authorization_invalid");
  const root = fs.realpathSync(path.resolve(options.root));
  const filename = resolveConfinedPath(root, options.state_ref, { allow_missing: true, label: "adaptive_state" });
  let lease: { filename: string; token: string } | undefined;
  try {
    lease = acquireLease(filename);
    const before = readState(filename, options.proposal.scope);
    if (before.applied_proposal_ids.includes(options.proposal.id)) {
      if (!before.applied_proposal_digests || before.applied_proposal_digests[options.proposal.id] !== options.proposal.digest) throw new Error("adaptive_state_idempotency_digest_mismatch");
      const rollbackRef = rollbackReference(options.proposal);
      const rollbackFile = rollbackLocation(root, rollbackRef);
      if (!fs.existsSync(rollbackFile)) throw new Error("adaptive_promotion_recovery_backup_missing");
      const previous = JSON.parse(fs.readFileSync(rollbackFile, "utf8")) as AdaptiveState;
      if (digestValue(withoutDigest(previous as unknown as Record<string, unknown>)) !== previous.digest || previous.digest !== options.proposal.base_state_digest) throw new Error("adaptive_promotion_recovery_backup_invalid");
      const expectedAfter = buildAdaptiveState(previous, options.proposal);
      if (expectedAfter.digest !== before.digest) throw new Error("adaptive_promotion_recovery_state_mismatch");
      const journal = preparePromotionJournal(root, { proposal: options.proposal, decision: options.decision, envelope: options.envelope, state_ref: options.state_ref, before: previous, after: expectedAfter, rollback_ref: rollbackRef, applied_at: options.applied_at });
      const candidate = {
        contract_version: PROMOTION_RECEIPT_CONTRACT_VERSION,
        id: `promotion.${options.proposal.id}`,
        proposal_id: options.proposal.id,
        proposal_digest: options.proposal.digest,
        decision_digest: options.decision.digest,
        envelope_digest: options.envelope.digest,
        state_ref: options.state_ref,
        before_digest: previous.digest,
        after_digest: before.digest,
        revision: before.revision,
        status: "already_applied" as const,
        rollback_ref: rollbackRef,
        applied_change_ids: journal.applied_change_ids,
        applied_at: journal.applied_at,
        readback_verified: true,
        canonical_write_allowed: false as const
      };
      return persistReceipt(root, candidate);
    }
    if (before.digest !== options.proposal.base_state_digest) throw new Error("adaptive_state_compare_and_swap_failed");
    const rollbackRef = rollbackReference(options.proposal);
    const rollbackFile = rollbackLocation(root, rollbackRef);
    if (fs.existsSync(rollbackFile)) {
      const existing = JSON.parse(fs.readFileSync(rollbackFile, "utf8"));
      if (digestValue(existing) !== digestValue(before)) throw new Error("adaptive_rollback_backup_conflict");
    } else atomicJson(rollbackFile, before);
    const after = buildAdaptiveState(before, options.proposal);
    const journal = preparePromotionJournal(root, { proposal: options.proposal, decision: options.decision, envelope: options.envelope, state_ref: options.state_ref, before, after, rollback_ref: rollbackRef, applied_at: options.applied_at });
    atomicJson(filename, after);
    const verified = readState(filename, options.proposal.scope);
    if (verified.digest !== after.digest) throw new Error("adaptive_state_readback_mismatch");
    const candidate = {
      contract_version: PROMOTION_RECEIPT_CONTRACT_VERSION,
      id: `promotion.${options.proposal.id}`,
      proposal_id: options.proposal.id,
      proposal_digest: options.proposal.digest,
      decision_digest: options.decision.digest,
      envelope_digest: options.envelope.digest,
      state_ref: options.state_ref,
      before_digest: before.digest,
      after_digest: after.digest,
      revision: after.revision,
      status: "applied" as const,
      rollback_ref: rollbackRef,
      applied_change_ids: journal.applied_change_ids,
      applied_at: journal.applied_at,
      readback_verified: true,
      canonical_write_allowed: false as const
    };
    return persistReceipt(root, candidate);
  } finally {
    releaseLease(lease);
  }
}

export function rollbackAdaptiveEvolution(options: { root: string; state_ref: string; receipt: PromotionReceipt; rolled_back_at: string }): PromotionReceipt {
  assertStateRef(options.state_ref);
  if (digestValue(withoutDigest(options.receipt as unknown as Record<string, unknown>)) !== options.receipt.digest) throw new Error("promotion_receipt_digest_mismatch");
  if (!(["applied", "already_applied"] as string[]).includes(options.receipt.status) || !options.receipt.rollback_ref || options.receipt.state_ref !== options.state_ref) throw new Error("promotion_receipt_not_rollbackable");
  const root = fs.realpathSync(path.resolve(options.root));
  const filename = resolveConfinedPath(root, options.state_ref, { label: "adaptive_state" });
  const rollbackFile = rollbackLocation(root, options.receipt.rollback_ref);
  let lease: { filename: string; token: string } | undefined;
  try {
    lease = acquireLease(filename);
    const previous = JSON.parse(fs.readFileSync(rollbackFile, "utf8")) as AdaptiveState;
    if (digestValue(withoutDigest(previous as unknown as Record<string, unknown>)) !== previous.digest) throw new Error("adaptive_rollback_backup_invalid");
    const current = readState(filename, previous.scope);
    if (current.digest !== previous.digest) {
      if (current.digest !== options.receipt.after_digest) throw new Error("adaptive_rollback_state_changed");
      atomicJson(filename, previous);
      const verified = readState(filename, previous.scope);
      if (verified.digest !== previous.digest) throw new Error("adaptive_rollback_readback_mismatch");
    }
    const candidate = { ...withoutDigest(options.receipt as unknown as Record<string, unknown>), status: "rolled_back" as const, after_digest: previous.digest, applied_at: options.rolled_back_at, readback_verified: true, canonical_write_allowed: false as const };
    return persistReceipt(root, candidate as unknown as Omit<PromotionReceipt, "digest">);
  } finally {
    releaseLease(lease);
  }
}
