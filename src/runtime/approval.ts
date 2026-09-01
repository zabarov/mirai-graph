import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalJson, digestValue } from "../core/canonical.js";
import {
  APPROVAL_CONTRACT_VERSION,
  type ApprovalReceipt,
  type EffectName
} from "./contracts.js";

const KEY_FILE = "approval.key";

function ensureDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("approval_home_symlink_forbidden");
  fs.chmodSync(directory, 0o700);
}

function approvalKey(home: string): Buffer {
  const root = path.resolve(home);
  ensureDirectory(root);
  const filename = path.join(root, KEY_FILE);
  if (fs.existsSync(filename)) {
    if (fs.lstatSync(filename).isSymbolicLink()) throw new Error("approval_key_symlink_forbidden");
    return fs.readFileSync(filename);
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
  program_digest: string;
  sandbox: string;
  effects: EffectName[];
  node_ids?: string[];
  approver: string;
  ttl_ms?: number;
  now?: Date;
}): ApprovalReceipt {
  const now = options.now || new Date();
  const effects = [...new Set(options.effects)].sort();
  if (!effects.length) throw new Error("approval_effects_required");
  const payload = {
    contract_version: APPROVAL_CONTRACT_VERSION,
    approval_id: `approval.${digestValue({ program: options.program_digest, sandbox: path.resolve(options.sandbox), effects, at: now.toISOString() }).slice(7, 23)}`,
    approved: true as const,
    program_digest: options.program_digest,
    sandbox_digest: sandboxDigest(options.sandbox),
    effects,
    node_ids: [...new Set(options.node_ids || [])].sort(),
    approver: options.approver,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + (options.ttl_ms || 15 * 60 * 1000)).toISOString(),
    canonical_write_allowed: false as const,
    signature_algorithm: "hmac-sha256-local" as const
  };
  return { ...payload, signature: sign(payload, approvalKey(options.home)) };
}

export function verifyApprovalReceipt(receipt: ApprovalReceipt, options: {
  home: string;
  program_digest: string;
  sandbox: string;
  effects: EffectName[];
  node_id?: string;
  now?: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (receipt.contract_version !== APPROVAL_CONTRACT_VERSION || receipt.approved !== true) errors.push("approval_contract_invalid");
  if (receipt.canonical_write_allowed !== false) errors.push("approval_canonical_write_boundary_invalid");
  if (receipt.program_digest !== options.program_digest) errors.push("approval_program_digest_mismatch");
  if (receipt.sandbox_digest !== sandboxDigest(options.sandbox)) errors.push("approval_sandbox_mismatch");
  for (const effect of options.effects) if (!receipt.effects.includes(effect)) errors.push(`approval_effect_missing:${effect}`);
  if (options.node_id && receipt.node_ids.length && !receipt.node_ids.includes(options.node_id)) errors.push(`approval_node_missing:${options.node_id}`);
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
