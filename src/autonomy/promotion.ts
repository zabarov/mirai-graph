import fs from "node:fs";
import path from "node:path";
import { digestValue, withoutDigest } from "../core/canonical.js";
import { resolveConfinedPath } from "../core/path-boundary.js";
import {
  PROMOTION_RECEIPT_CONTRACT_VERSION,
  type AdaptiveState,
  type AdaptiveChangeKind,
  type AutonomyEnvelope,
  type EvolutionDecision,
  type EvolutionProposal,
  type PromotionReceipt
} from "./types.js";

function emptyState(scope: string): AdaptiveState {
  const candidate = { contract_version: "1.0.0" as const, scope, revision: 0, records: {}, applied_proposal_ids: [] as string[] };
  return { ...candidate, digest: digestValue(candidate) };
}

function readState(filename: string, scope: string): AdaptiveState {
  if (!fs.existsSync(filename)) return emptyState(scope);
  const state = JSON.parse(fs.readFileSync(filename, "utf8")) as AdaptiveState;
  if (state.scope !== scope || digestValue(withoutDigest(state as unknown as Record<string, unknown>)) !== state.digest) throw new Error("adaptive_state_invalid");
  return state;
}

function atomicJson(filename: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, filename);
  const readback = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (digestValue(readback) !== digestValue(value)) throw new Error("adaptive_state_readback_mismatch");
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
  if (options.decision.verdict !== "automatic_promotion_allowed") throw new Error("automatic_promotion_not_allowed");
  if (options.decision.proposal_digest !== options.proposal.digest || options.decision.envelope_digest !== options.envelope.digest) throw new Error("promotion_binding_mismatch");
  if (!options.verify_authorization(options.authorization_ref, options.envelope)) throw new Error("autonomy_authorization_invalid");
  const root = fs.realpathSync(path.resolve(options.root));
  const filename = resolveConfinedPath(root, options.state_ref, { allow_missing: true, label: "adaptive_state" });
  const lease = `${filename}.lease`;
  let leaseFd: number | undefined;
  try {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    leaseFd = fs.openSync(lease, "wx", 0o600);
    const before = readState(filename, options.proposal.scope);
    if (before.applied_proposal_ids.includes(options.proposal.id)) {
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
      return { ...candidate, digest: digestValue(candidate) };
    }
    if (before.digest !== options.proposal.base_state_digest) throw new Error("adaptive_state_compare_and_swap_failed");
    const rollbackDir = resolveConfinedPath(root, ".mirai/migration-backups/autonomic", { allow_missing: true, label: "adaptive_rollback" });
    fs.mkdirSync(rollbackDir, { recursive: true });
    const rollbackRef = `.mirai/migration-backups/autonomic/${options.proposal.id}.json`;
    const rollbackFile = resolveConfinedPath(root, rollbackRef, { allow_missing: true, label: "adaptive_rollback" });
    atomicJson(rollbackFile, before);
    const records = { ...before.records };
    for (const change of options.proposal.changes) {
      if (!change.target_ref.startsWith("adaptive/") || change.stratum !== "adaptive_canonical") throw new Error("promotion_target_not_adaptive");
      records[change.target_ref] = {
        kind: change.kind as AdaptiveChangeKind,
        lifecycle: change.operation === "deprecate" ? "deprecated" : "active",
        payload: change.payload,
        payload_digest: change.payload_digest,
        proposal_ref: options.proposal.id,
        evidence_refs: change.evidence_refs
      } as typeof records[string];
    }
    const body = { contract_version: "1.0.0" as const, scope: before.scope, revision: before.revision + 1, records, applied_proposal_ids: [...before.applied_proposal_ids, options.proposal.id].sort() };
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
    return { ...candidate, digest: digestValue(candidate) };
  } finally {
    if (leaseFd !== undefined) fs.closeSync(leaseFd);
    if (fs.existsSync(lease)) fs.unlinkSync(lease);
  }
}

export function rollbackAdaptiveEvolution(options: { root: string; state_ref: string; receipt: PromotionReceipt; rolled_back_at: string }): PromotionReceipt {
  if (options.receipt.status !== "applied" || !options.receipt.rollback_ref) throw new Error("promotion_receipt_not_rollbackable");
  const root = fs.realpathSync(path.resolve(options.root));
  const filename = resolveConfinedPath(root, options.state_ref, { label: "adaptive_state" });
  const rollbackFile = resolveConfinedPath(root, options.receipt.rollback_ref, { label: "adaptive_rollback" });
  const current = readState(filename, JSON.parse(fs.readFileSync(rollbackFile, "utf8")).scope);
  if (current.digest !== options.receipt.after_digest) throw new Error("adaptive_rollback_state_changed");
  const previous = JSON.parse(fs.readFileSync(rollbackFile, "utf8")) as AdaptiveState;
  atomicJson(filename, previous);
  const candidate = { ...withoutDigest(options.receipt as unknown as Record<string, unknown>), status: "rolled_back" as const, after_digest: previous.digest, applied_at: options.rolled_back_at, readback_verified: true, canonical_write_allowed: false as const };
  return { ...candidate, digest: digestValue(candidate) } as unknown as PromotionReceipt;
}
