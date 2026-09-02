import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalJson, digestValue, withoutDigest } from "../core/canonical.js";
import {
  INVARIANT_CONTRACT_VERSION,
  MANDATE_CONTRACT_VERSION,
  type ApprovalRequestScope,
  type CapabilityRequest,
  type EffectName,
  type InvariantEvaluationResult,
  type InvariantRule,
  type LayeredInvariantSet,
  type MandateReceipt
} from "./contracts.js";

const KEY_FILE = "mandate.key";

function ensureDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("mandate_home_symlink_forbidden");
  fs.chmodSync(directory, 0o700);
}

function mandateKey(home: string): Buffer {
  const root = path.resolve(home);
  ensureDirectory(root);
  const filename = path.join(root, KEY_FILE);
  if (fs.existsSync(filename)) {
    if (fs.lstatSync(filename).isSymbolicLink()) throw new Error("mandate_key_symlink_forbidden");
    const stat = fs.statSync(filename);
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error("mandate_key_permissions_too_open");
    const key = fs.readFileSync(filename);
    if (key.byteLength !== 32) throw new Error("mandate_key_length_invalid");
    return key;
  }
  const key = randomBytes(32);
  fs.writeFileSync(filename, key, { mode: 0o600, flag: "wx" });
  return key;
}

function unsigned(receipt: MandateReceipt): Omit<MandateReceipt, "signature"> {
  const { signature: _signature, ...payload } = receipt;
  return payload;
}

function sign(payload: Omit<MandateReceipt, "signature">, key: Buffer): string {
  return `hmac-sha256:${createHmac("sha256", key).update(canonicalJson(payload)).digest("hex")}`;
}

function normalizeScopes(scopes: ApprovalRequestScope[]): ApprovalRequestScope[] {
  return scopes.map((scope) => ({ ...scope, effects: [...new Set(scope.effects)].sort() }));
}

export function createMandateReceipt(options: {
  home: string;
  subject: string;
  issuer: string;
  run_id: string;
  program_digest: string;
  input_digest: string;
  policy_digest: string;
  request_scopes: ApprovalRequestScope[];
  ttl_ms?: number;
  now?: Date;
}): MandateReceipt {
  const now = options.now || new Date();
  const ttlMs = options.ttl_ms ?? 60 * 60 * 1000;
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 30 * 24 * 60 * 60 * 1000) throw new Error("mandate_ttl_invalid");
  if (!options.subject.trim()) throw new Error("mandate_subject_required");
  if (!options.issuer.trim()) throw new Error("mandate_issuer_required");
  if (!options.run_id.trim() || !options.request_scopes.length) throw new Error("mandate_scope_required");
  const requestScopes = normalizeScopes(options.request_scopes);
  for (const scope of requestScopes) {
    if (scope.run_id !== options.run_id) throw new Error("mandate_scope_run_mismatch");
    if (scope.program_digest !== options.program_digest) throw new Error("mandate_scope_program_mismatch");
    if (scope.input_digest !== options.input_digest) throw new Error("mandate_scope_input_mismatch");
    if (scope.policy_digest !== options.policy_digest) throw new Error("mandate_scope_policy_mismatch");
  }
  const payload = {
    contract_version: MANDATE_CONTRACT_VERSION,
    mandate_id: `mandate.${digestValue({ subject: options.subject, issuer: options.issuer, run: options.run_id, scopes: requestScopes, at: now.toISOString() }).slice(7, 23)}`,
    status: "active" as const,
    subject: options.subject,
    issuer: options.issuer,
    run_id: options.run_id,
    program_digest: options.program_digest,
    input_digest: options.input_digest,
    policy_digest: options.policy_digest,
    request_scopes: requestScopes,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    canonical_write_allowed: false as const,
    signature_algorithm: "hmac-sha256-local" as const
  };
  return { ...payload, signature: sign(payload, mandateKey(options.home)) };
}

export function revokeMandateReceipt(receipt: MandateReceipt, options: { home: string; revocation_ref: string }): MandateReceipt {
  if (!options.revocation_ref.trim()) throw new Error("mandate_revocation_ref_required");
  const payload = { ...unsigned(receipt), status: "revoked" as const, revocation_ref: options.revocation_ref };
  return { ...payload, signature: sign(payload, mandateKey(options.home)) };
}

export function verifyMandateReceipt(receipt: MandateReceipt, options: { home: string; request: CapabilityRequest; now?: Date }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (receipt.contract_version !== MANDATE_CONTRACT_VERSION) errors.push("mandate_contract_invalid");
  if (receipt.status !== "active") errors.push("mandate_revoked");
  if (receipt.canonical_write_allowed !== false) errors.push("mandate_canonical_write_boundary_invalid");
  if (receipt.run_id !== options.request.run_id) errors.push("mandate_run_id_mismatch");
  if (receipt.program_digest !== options.request.program_digest) errors.push("mandate_program_digest_mismatch");
  if (receipt.input_digest !== options.request.input_digest) errors.push("mandate_input_digest_mismatch");
  if (receipt.policy_digest !== options.request.policy_digest) errors.push("mandate_policy_digest_mismatch");
  const { contract_version: _contract, request_id: _requestId, request_digest: _requestDigest, approval_required: _approvalRequired, ...scope } = options.request;
  if (!receipt.request_scopes.some((candidate) => digestValue(candidate) === digestValue(scope))) errors.push("mandate_request_scope_mismatch");
  const now = options.now || new Date();
  if (!Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= now.getTime()) errors.push("mandate_expired");
  if (!Number.isFinite(Date.parse(receipt.issued_at)) || Date.parse(receipt.issued_at) > now.getTime() + 60_000) errors.push("mandate_issued_at_invalid");
  try {
    const expected = sign(unsigned(receipt), mandateKey(options.home));
    const actualBuffer = Buffer.from(receipt.signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) errors.push("mandate_signature_invalid");
  } catch {
    errors.push("mandate_signature_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

function sameSet(left: string[], right: string[]): boolean {
  return [...new Set(left)].sort().join("\u0000") === [...new Set(right)].sort().join("\u0000");
}

function resourceMatchesPrefix(resource: string, prefix: string): boolean {
  if (resource === prefix) return true;
  if (prefix === ".") return resource.startsWith("./");
  if (prefix.endsWith(":")) return resource.startsWith(prefix);
  return resource.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

function matches(rule: InvariantRule, request: CapabilityRequest): boolean {
  return (!rule.adapters.length || rule.adapters.includes(request.adapter))
    && (!rule.operations.length || rule.operations.includes(request.action))
    && (!rule.effects.length || sameSet(rule.effects, request.effects))
    && (!rule.resource_prefixes.length || rule.resource_prefixes.some((prefix) => resourceMatchesPrefix(request.resource, prefix)));
}

export function createLayeredInvariantSet(value: Omit<LayeredInvariantSet, "contract_version" | "canonical_write_allowed" | "digest">): LayeredInvariantSet {
  const candidate = { contract_version: INVARIANT_CONTRACT_VERSION, ...value, canonical_write_allowed: false as const };
  return { ...candidate, digest: digestValue(candidate) };
}

export function evaluateLayeredInvariants(request: CapabilityRequest, sets: LayeredInvariantSet[]): InvariantEvaluationResult {
  const invalid = sets.filter((set) => set.contract_version !== INVARIANT_CONTRACT_VERSION || set.canonical_write_allowed !== false || set.digest !== digestValue(withoutDigest(set as unknown as Record<string, unknown>)));
  const rules = sets.flatMap((set) => set.rules).filter((rule) => matches(rule, request));
  const denied = rules.filter((rule) => rule.decision === "deny");
  const protectedRules = rules.filter((rule) => rule.protected);
  const decision: InvariantEvaluationResult["decision"] = invalid.length || denied.length ? "denied" : rules.some((rule) => rule.decision === "allow") ? "allowed" : "unmatched";
  const reasons = [
    ...invalid.map((set) => `invariant_set_invalid:${set.id}`),
    ...denied.map((rule) => `invariant_denied:${rule.id}`),
    ...(decision === "allowed" ? ["all_applicable_invariants_allow"] : []),
    ...(decision === "unmatched" ? ["no_applicable_invariant"] : [])
  ];
  const candidate = {
    contract_version: INVARIANT_CONTRACT_VERSION,
    request_id: request.request_id,
    decision,
    matched_rule_ids: rules.map((rule) => rule.id).sort(),
    denied_rule_ids: denied.map((rule) => rule.id).sort(),
    protected_rule_ids: protectedRules.map((rule) => rule.id).sort(),
    reasons: [...new Set(reasons)].sort(),
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
