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

function acquireLease(filename: string): { filename: string; token: string } {
  const lease = `${filename}.lease`;
  const token = randomUUID();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  try {
    const descriptor = fs.openSync(lease, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, token, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("adaptive_state_lease_unavailable");
    throw error;
  }
  return { filename: lease, token };
}

function releaseLease(lease: { filename: string; token: string } | undefined): void {
  if (!lease || !fs.existsSync(lease.filename)) return;
  if (fs.readFileSync(lease.filename, "utf8") !== lease.token) throw new Error("adaptive_state_lease_ownership_lost");
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
      const candidate = {
        contract_version: PROMOTION_RECEIPT_CONTRACT_VERSION,
        id: `promotion.${options.proposal.id}`,
        proposal_id: options.proposal.id,
        proposal_digest: options.proposal.digest,
        decision_digest: options.decision.digest,
        envelope_digest: options.envelope.digest,
        state_ref: options.state_ref,
        before_digest: before.digest,
        after_digest: before.digest,
        revision: before.revision,
        status: "already_applied" as const,
        applied_change_ids: [],
        applied_at: options.applied_at,
        readback_verified: true,
        canonical_write_allowed: false as const
      };
      return persistReceipt(root, candidate);
    }
    if (before.digest !== options.proposal.base_state_digest) throw new Error("adaptive_state_compare_and_swap_failed");
    const rollbackRef = `.mirai/migration-backups/autonomic/${options.proposal.id}.${options.proposal.digest.slice(7, 19)}.json`;
    const rollbackFile = rollbackLocation(root, rollbackRef);
    if (fs.existsSync(rollbackFile)) {
      const existing = JSON.parse(fs.readFileSync(rollbackFile, "utf8"));
      if (digestValue(existing) !== digestValue(before)) throw new Error("adaptive_rollback_backup_conflict");
    } else atomicJson(rollbackFile, before);
    const records = { ...before.records };
    for (const change of options.proposal.changes) {
      records[change.target_ref] = {
        kind: change.kind as AdaptiveChangeKind,
        lifecycle: change.operation === "deprecate" ? "deprecated" : "active",
        payload: change.payload,
        payload_digest: change.payload_digest,
        proposal_ref: options.proposal.id,
        evidence_refs: change.evidence_refs
      } as typeof records[string];
    }
    const body = {
      contract_version: "1.0.0" as const,
      scope: before.scope,
      revision: before.revision + 1,
      records,
      applied_proposal_ids: [...before.applied_proposal_ids, options.proposal.id].sort(),
      applied_proposal_digests: { ...(before.applied_proposal_digests || {}), [options.proposal.id]: options.proposal.digest }
    };
    const after: AdaptiveState = { ...body, digest: digestValue(body) };
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
      applied_change_ids: options.proposal.changes.map((item) => item.id).sort(),
      applied_at: options.applied_at,
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
  if (options.receipt.status !== "applied" || !options.receipt.rollback_ref || options.receipt.state_ref !== options.state_ref) throw new Error("promotion_receipt_not_rollbackable");
  const root = fs.realpathSync(path.resolve(options.root));
  const filename = resolveConfinedPath(root, options.state_ref, { label: "adaptive_state" });
  const rollbackFile = rollbackLocation(root, options.receipt.rollback_ref);
  let lease: { filename: string; token: string } | undefined;
  try {
    lease = acquireLease(filename);
    const previous = JSON.parse(fs.readFileSync(rollbackFile, "utf8")) as AdaptiveState;
    if (digestValue(withoutDigest(previous as unknown as Record<string, unknown>)) !== previous.digest) throw new Error("adaptive_rollback_backup_invalid");
    const current = readState(filename, previous.scope);
    if (current.digest !== options.receipt.after_digest) throw new Error("adaptive_rollback_state_changed");
    atomicJson(filename, previous);
    const verified = readState(filename, previous.scope);
    if (verified.digest !== previous.digest) throw new Error("adaptive_rollback_readback_mismatch");
    const candidate = { ...withoutDigest(options.receipt as unknown as Record<string, unknown>), status: "rolled_back" as const, after_digest: previous.digest, applied_at: options.rolled_back_at, readback_verified: true, canonical_write_allowed: false as const };
    return persistReceipt(root, candidate as unknown as Omit<PromotionReceipt, "digest">);
  } finally {
    releaseLease(lease);
  }
}
