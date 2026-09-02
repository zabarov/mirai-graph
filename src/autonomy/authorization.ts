import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalJson, digestValue } from "../core/canonical.js";
import { assertNoSymlinkComponents } from "../core/path-boundary.js";
import {
  AUTONOMY_AUTHORIZATION_CONTRACT_VERSION,
  type AutonomyAuthorizationReceipt,
  type AutonomyEnvelope
} from "./types.js";
import { validateAutonomyEnvelope } from "./evaluator.js";

const KEY_FILE = "autonomy-approval.key";

function authorizationKey(homeInput: string): Buffer {
  const home = path.resolve(homeInput);
  assertNoSymlinkComponents(home, true, "autonomy_home");
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.chmodSync(home, 0o700);
  const filename = path.join(home, KEY_FILE);
  if (fs.existsSync(filename)) {
    if (fs.lstatSync(filename).isSymbolicLink()) throw new Error("autonomy_key_symlink_forbidden");
    const stat = fs.statSync(filename);
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error("autonomy_key_permissions_too_open");
    const value = fs.readFileSync(filename);
    if (value.byteLength !== 32) throw new Error("autonomy_key_length_invalid");
    return value;
  }
  const value = randomBytes(32);
  fs.writeFileSync(filename, value, { flag: "wx", mode: 0o600 });
  return value;
}

function unsigned(receipt: AutonomyAuthorizationReceipt): Omit<AutonomyAuthorizationReceipt, "signature"> {
  const { signature: _signature, ...value } = receipt;
  return value;
}

function sign(value: Omit<AutonomyAuthorizationReceipt, "signature">, key: Buffer): string {
  return `hmac-sha256:${createHmac("sha256", key).update(canonicalJson(value)).digest("hex")}`;
}

export function createAutonomyAuthorizationReceipt(options: {
  home: string;
  envelope: AutonomyEnvelope;
  approved_by: string;
  ttl_ms?: number;
  now?: Date;
}): AutonomyAuthorizationReceipt {
  if (!options.approved_by.trim()) throw new Error("autonomy_approver_required");
  const now = options.now || new Date();
  const envelopeErrors = validateAutonomyEnvelope(options.envelope, now.toISOString());
  if (envelopeErrors.length) throw new Error(`autonomy_envelope_invalid:${envelopeErrors.join(",")}`);
  const envelopeExpiry = Date.parse(options.envelope.expires_at);
  if (!Number.isFinite(envelopeExpiry) || envelopeExpiry <= now.getTime()) throw new Error("autonomy_envelope_expired");
  const ttl = options.ttl_ms ?? 24 * 60 * 60 * 1000;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 90 * 24 * 60 * 60 * 1000) throw new Error("autonomy_authorization_ttl_invalid");
  const expiresAt = new Date(Math.min(now.getTime() + ttl, envelopeExpiry)).toISOString();
  const value = {
    contract_version: AUTONOMY_AUTHORIZATION_CONTRACT_VERSION,
    id: `autonomy_authorization.${digestValue({ envelope: options.envelope.digest, approver: options.approved_by, at: now.toISOString() }).slice(7, 23)}`,
    approved: true as const,
    envelope_id: options.envelope.id,
    envelope_digest: options.envelope.digest,
    scope: options.envelope.scope,
    policy_digest: options.envelope.policy_digest,
    approved_by: options.approved_by,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    canonical_write_allowed: false as const,
    signature_algorithm: "hmac-sha256-local" as const
  };
  return { ...value, signature: sign(value, authorizationKey(options.home)) };
}

export function verifyAutonomyAuthorizationReceipt(receipt: AutonomyAuthorizationReceipt, options: {
  home: string;
  envelope: AutonomyEnvelope;
  now?: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = options.now || new Date();
  errors.push(...validateAutonomyEnvelope(options.envelope, now.toISOString()));
  if (receipt.contract_version !== AUTONOMY_AUTHORIZATION_CONTRACT_VERSION || receipt.approved !== true) errors.push("autonomy_authorization_contract_invalid");
  if (receipt.canonical_write_allowed !== false) errors.push("autonomy_authorization_boundary_invalid");
  if (receipt.envelope_id !== options.envelope.id || receipt.envelope_digest !== options.envelope.digest) errors.push("autonomy_authorization_envelope_mismatch");
  if (receipt.scope !== options.envelope.scope || receipt.policy_digest !== options.envelope.policy_digest) errors.push("autonomy_authorization_scope_mismatch");
  if (!Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= now.getTime()) errors.push("autonomy_authorization_expired");
  if (!Number.isFinite(Date.parse(receipt.issued_at)) || Date.parse(receipt.issued_at) > now.getTime() + 60_000) errors.push("autonomy_authorization_issued_at_invalid");
  try {
    const expected = Buffer.from(sign(unsigned(receipt), authorizationKey(options.home)));
    const actual = Buffer.from(receipt.signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) errors.push("autonomy_authorization_signature_invalid");
  } catch {
    errors.push("autonomy_authorization_signature_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}
