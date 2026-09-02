import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalJson, digestValue } from "../core/canonical.js";
import { assertNoSymlinkComponents } from "../core/path-boundary.js";
import {
  APPROVAL_CONTRACT_VERSION,
  type ApprovalReceipt,
  type ApprovalRequestScope,
  type CapabilityRequest,
  type EffectName
} from "./contracts.js";

const KEY_FILE = "approval.key";

function ensureDirectory(directory: string): void {
  assertNoSymlinkComponents(directory, true, "approval_home");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function approvalKey(home: string): Buffer {
  const root = path.resolve(home);
  ensureDirectory(root);
  const filename = path.join(root, KEY_FILE);
  if (fs.existsSync(filename)) {
    if (fs.lstatSync(filename).isSymbolicLink()) throw new Error("approval_key_symlink_forbidden");
    const stat = fs.statSync(filename);
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error("approval_key_permissions_too_open");
    const existing = fs.readFileSync(filename);
    if (existing.byteLength !== 32) throw new Error("approval_key_length_invalid");
    return existing;
  }
  const key = randomBytes(32);
  fs.writeFileSync(filename, key, { mode: 0o600, flag: "wx" });
  return key;
}

function unsigned(receipt: ApprovalReceipt): Omit<ApprovalReceipt, "signature"> {
  const { signature: _signature, ...payload } = receipt;
  return payload;
}

function sign(payload: Omit<ApprovalReceipt, "signature">, key: Buffer): string {
  return `hmac-sha256:${createHmac("sha256", key).update(canonicalJson(payload)).digest("hex")}`;
}

export function sandboxDigest(sandbox: string): string {
  return digestValue({ sandbox: path.resolve(sandbox) });
}

export function createApprovalReceipt(options: {
  home: string;
  run_id: string;
  program_digest: string;
  input_digest: string;
  policy_digest: string;
  sandbox: string;
  effects: EffectName[];
  request_scopes: ApprovalRequestScope[];
  approver: string;
  ttl_ms?: number;
  now?: Date;
}): ApprovalReceipt {
  const now = options.now || new Date();
  const ttlMs = options.ttl_ms ?? 15 * 60 * 1000;
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 24 * 60 * 60 * 1000) throw new Error("approval_ttl_invalid");
  if (!options.approver.trim()) throw new Error("approval_approver_required");
  const effects = [...new Set(options.effects)].sort();
  if (!effects.length) throw new Error("approval_effects_required");
  if (!options.run_id.trim()) throw new Error("approval_run_id_required");
  if (!options.request_scopes.length) throw new Error("approval_request_scopes_required");
  const requestScopes = options.request_scopes.map((scope) => ({ ...scope, effects: [...new Set(scope.effects)].sort() }));
  for (const scope of requestScopes) {
    if (scope.run_id !== options.run_id) throw new Error("approval_scope_run_mismatch");
    if (scope.program_digest !== options.program_digest) throw new Error("approval_scope_program_mismatch");
    if (scope.input_digest !== options.input_digest) throw new Error("approval_scope_input_mismatch");
    if (scope.policy_digest !== options.policy_digest) throw new Error("approval_scope_policy_mismatch");
    if (!effects.every((effect) => scope.effects.includes(effect))) throw new Error("approval_scope_effect_mismatch");
  }
  const nodeIds = [...new Set(requestScopes.map((scope) => scope.node_id))].sort();
  const payload = {
    contract_version: APPROVAL_CONTRACT_VERSION,
    approval_id: `approval.${digestValue({ run: options.run_id, program: options.program_digest, input: options.input_digest, sandbox: path.resolve(options.sandbox), policy: options.policy_digest, scopes: requestScopes, at: now.toISOString() }).slice(7, 23)}`,
    approved: true as const,
    run_id: options.run_id,
    program_digest: options.program_digest,
    input_digest: options.input_digest,
    policy_digest: options.policy_digest,
    sandbox_digest: sandboxDigest(options.sandbox),
    effects,
    node_ids: nodeIds,
    request_scopes: requestScopes,
    approver: options.approver,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    canonical_write_allowed: false as const,
    signature_algorithm: "hmac-sha256-local" as const
  };
  return { ...payload, signature: sign(payload, approvalKey(options.home)) };
}

export function verifyApprovalReceipt(receipt: ApprovalReceipt, options: {
  home: string;
  sandbox: string;
  request: CapabilityRequest;
  now?: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (receipt.contract_version !== APPROVAL_CONTRACT_VERSION || receipt.approved !== true) errors.push("approval_contract_invalid");
  if (receipt.canonical_write_allowed !== false) errors.push("approval_canonical_write_boundary_invalid");
  if (receipt.run_id !== options.request.run_id) errors.push("approval_run_id_mismatch");
  if (receipt.program_digest !== options.request.program_digest) errors.push("approval_program_digest_mismatch");
  if (receipt.input_digest !== options.request.input_digest) errors.push("approval_input_digest_mismatch");
  if (receipt.policy_digest !== options.request.policy_digest) errors.push("approval_policy_digest_mismatch");
  if (receipt.sandbox_digest !== sandboxDigest(options.sandbox)) errors.push("approval_sandbox_mismatch");
  for (const effect of options.request.effects) if (!receipt.effects.includes(effect)) errors.push(`approval_effect_missing:${effect}`);
  if (!receipt.node_ids.includes(options.request.node_id)) errors.push(`approval_node_missing:${options.request.node_id}`);
  const { contract_version: _contract, request_id: _requestId, request_digest: _requestDigest, approval_required: _approvalRequired, ...scope } = options.request;
  if (!receipt.request_scopes.some((candidate) => digestValue(candidate) === digestValue(scope))) errors.push("approval_request_scope_mismatch");
  const now = options.now || new Date();
  if (!Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= now.getTime()) errors.push("approval_expired");
  if (!Number.isFinite(Date.parse(receipt.issued_at)) || Date.parse(receipt.issued_at) > now.getTime() + 60_000) errors.push("approval_issued_at_invalid");
  try {
    const expected = sign(unsigned(receipt), approvalKey(options.home));
    const actualBuffer = Buffer.from(receipt.signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) errors.push("approval_signature_invalid");
  } catch {
    errors.push("approval_signature_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}
