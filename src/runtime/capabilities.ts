import { randomBytes } from "node:crypto";
import { digestValue } from "../core/canonical.js";
import {
  CAPABILITY_CONTRACT_VERSION,
  type ApprovalReceipt,
  type CapabilityGrant,
  type CapabilityRequest,
  type EffectName,
  type PolicyDecisionRecord
} from "./contracts.js";
import { verifyApprovalReceipt } from "./approval.js";
import { evaluateLayeredInvariants, verifyMandateReceipt } from "./authorization.js";
import type { InvariantEvaluationResult, LayeredInvariantSet, MandateReceipt } from "./contracts.js";

export interface CapabilityRule {
  id: string;
  adapters: string[];
  operations: string[];
  effects: EffectName[];
  resource_prefixes: string[];
  approval_required: boolean;
}

export interface CapabilityPolicy {
  contract_version: "1.0.0";
  rules: CapabilityRule[];
  grant_ttl_ms: number;
  max_calls_per_grant: number;
}

export interface CapabilityDecision {
  decision: PolicyDecisionRecord;
  grant?: CapabilityGrant;
}

export interface CapabilityAuthorization {
  mandate_required: boolean;
  invariant_match_required: boolean;
  mandate?: MandateReceipt;
  invariant_sets: LayeredInvariantSet[];
}

export const DEFAULT_CAPABILITY_POLICY: CapabilityPolicy = {
  contract_version: "1.0.0",
  grant_ttl_ms: 5 * 60 * 1000,
  max_calls_per_grant: 1,
  rules: [
    { id: "capability.repository.read", adapters: ["repository"], operations: ["read_file", "list_files"], effects: ["repository_read"], resource_prefixes: ["."], approval_required: false },
    { id: "capability.git.read", adapters: ["git"], operations: ["status", "diff"], effects: ["git_read"], resource_prefixes: ["."], approval_required: false },
    { id: "capability.workspace.patch", adapters: ["workspace"], operations: ["write_file"], effects: ["workspace_patch"], resource_prefixes: ["."], approval_required: true },
    { id: "capability.test.run", adapters: ["test"], operations: ["run"], effects: ["process_run"], resource_prefixes: ["command:"], approval_required: true },
    { id: "capability.human.approval", adapters: ["human"], operations: ["approval"], effects: ["human_approval"], resource_prefixes: ["approval:"], approval_required: true }
  ]
};

export function policyDigest(policy: CapabilityPolicy): string {
  return digestValue(policy);
}

function sameSet(left: string[], right: string[]): boolean {
  return [...new Set(left)].sort().join("\u0000") === [...new Set(right)].sort().join("\u0000");
}

function resourceMatchesPrefix(resource: string, prefix: string): boolean {
  if (resource === prefix) return true;
  if (prefix === ".") return resource.startsWith("./");
  if (prefix.endsWith(":")) return resource.startsWith(prefix);
  const boundary = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return resource.startsWith(boundary);
}

export class ReferenceCapabilityProvider {
  readonly digest: string;

  constructor(
    readonly policy: CapabilityPolicy,
    readonly context: {
      home: string;
      sandbox: string;
      apply: boolean;
      approval?: ApprovalReceipt;
      approval_ref?: string;
      authorization?: CapabilityAuthorization;
    }
  ) {
    this.digest = policyDigest(policy);
  }

  request(request: CapabilityRequest, now = new Date()): CapabilityDecision {
    const reasons: string[] = [];
    const authorization = this.context.authorization;
    let invariantEvaluation: InvariantEvaluationResult | undefined;
    if (authorization?.mandate_required) {
      if (!authorization.mandate) reasons.push("mandate_required");
      else reasons.push(...verifyMandateReceipt(authorization.mandate, { home: this.context.home, request, now }).errors);
    }
    if (authorization?.invariant_sets.length) {
      invariantEvaluation = evaluateLayeredInvariants(request, authorization.invariant_sets);
      if (invariantEvaluation.decision === "denied") reasons.push(...invariantEvaluation.reasons);
      if (authorization.invariant_match_required && invariantEvaluation.decision === "unmatched") reasons.push("invariant_match_required");
    } else if (authorization?.invariant_match_required) reasons.push("invariant_match_required");
    const rule = this.policy.rules.find((item) => item.id === request.capability);
    if (!rule) reasons.push("capability_not_host_allowlisted");
    else {
      if (!rule.adapters.includes(request.adapter)) reasons.push("capability_adapter_mismatch");
      if (!rule.operations.includes(request.action)) reasons.push("capability_action_mismatch");
      if (!sameSet(rule.effects, request.effects)) reasons.push("capability_effect_mismatch");
      if (!rule.resource_prefixes.some((prefix) => resourceMatchesPrefix(request.resource, prefix))) reasons.push("capability_resource_mismatch");
      if (request.budget.max_calls < 1 || request.budget.max_calls > this.policy.max_calls_per_grant) reasons.push("capability_call_budget_invalid");
      if (request.policy_digest !== this.digest) reasons.push("capability_policy_digest_mismatch");
      if (rule.approval_required && !this.context.apply) reasons.push("apply_flag_required");
      if (rule.approval_required) {
        if (!this.context.approval) reasons.push("approval_receipt_required");
        else {
          const verified = verifyApprovalReceipt(this.context.approval, {
            home: this.context.home,
            sandbox: this.context.sandbox,
            request,
            now
          });
          reasons.push(...verified.errors);
        }
      }
    }
    const approvalOnly = reasons.length > 0 && reasons.every((item) => item === "apply_flag_required" || item === "approval_receipt_required");
    const decisionKind = reasons.length === 0 ? "granted" : approvalOnly ? "approval_required" : "denied";
    const decision: PolicyDecisionRecord = {
      contract_version: CAPABILITY_CONTRACT_VERSION,
      decision_id: `decision.${request.request_id.slice(request.request_id.lastIndexOf(".") + 1)}`,
      request_id: request.request_id,
      decision: decisionKind,
      reasons: reasons.length ? [...new Set(reasons)].sort() : ["host_policy_matched"],
      policy_digest: this.digest,
      ...(this.context.approval_ref ? { approval_receipt_ref: this.context.approval_ref } : {}),
      ...(authorization?.mandate ? { mandate_ref: `host-local://mandates/${authorization.mandate.mandate_id}` } : {}),
      ...(invariantEvaluation ? { invariant_evaluation_digest: invariantEvaluation.digest } : {}),
      decided_at: now.toISOString()
    };
    if (decisionKind !== "granted") return { decision };
    const grant: CapabilityGrant = {
      contract_version: CAPABILITY_CONTRACT_VERSION,
      grant_id: `grant.${request.request_id.slice(request.request_id.lastIndexOf(".") + 1)}.${randomBytes(5).toString("hex")}`,
      request_id: request.request_id,
      request_digest: request.request_digest,
      run_id: request.run_id,
      program_digest: request.program_digest,
      input_digest: request.input_digest,
      args_digest: request.args_digest,
      node_id: request.node_id,
      adapter: request.adapter,
      action: request.action,
      resource: request.resource,
      effects: request.effects,
      capability: request.capability,
      budget: request.budget,
      policy_digest: request.policy_digest,
      ...(this.context.approval_ref ? { approval_receipt_ref: this.context.approval_ref } : {}),
      ...(authorization?.mandate ? { mandate_ref: `host-local://mandates/${authorization.mandate.mandate_id}` } : {}),
      ...(invariantEvaluation ? { invariant_evaluation_digest: invariantEvaluation.digest } : {}),
      issued_at: now.toISOString(),
      expires_at: new Date(now.getTime() + this.policy.grant_ttl_ms).toISOString(),
      opaque_token: randomBytes(32).toString("base64url")
    };
    return { decision, grant };
  }
}

export function validateGrant(grant: CapabilityGrant, request: CapabilityRequest, now = new Date()): string[] {
  const errors: string[] = [];
  if (grant.contract_version !== CAPABILITY_CONTRACT_VERSION) errors.push("grant_contract_invalid");
  if (grant.run_id !== request.run_id) errors.push("grant_cross_run_reuse");
  if (grant.request_id !== request.request_id || grant.request_digest !== request.request_digest) errors.push("grant_request_mismatch");
  if (grant.program_digest !== request.program_digest || grant.input_digest !== request.input_digest || grant.node_id !== request.node_id) errors.push("grant_program_scope_mismatch");
  if (grant.args_digest !== request.args_digest) errors.push("grant_material_scope_mismatch");
  if (grant.adapter !== request.adapter || grant.action !== request.action || grant.resource !== request.resource) errors.push("grant_operation_scope_mismatch");
  if (!sameSet(grant.effects, request.effects) || grant.capability !== request.capability) errors.push("grant_effect_scope_mismatch");
  if (digestValue(grant.budget) !== digestValue(request.budget)) errors.push("grant_budget_scope_mismatch");
  if (grant.policy_digest !== request.policy_digest) errors.push("grant_policy_scope_mismatch");
  if (!grant.opaque_token || grant.opaque_token.length < 32) errors.push("grant_token_invalid");
  if (Date.parse(grant.expires_at) <= now.getTime()) errors.push("grant_expired");
  return [...new Set(errors)].sort();
}

export function buildCapabilityRequest(options: Omit<CapabilityRequest, "contract_version" | "request_id" | "request_digest">): CapabilityRequest {
  const base = { contract_version: CAPABILITY_CONTRACT_VERSION, ...options };
  const requestDigest = digestValue(base);
  return {
    ...base,
    request_id: `request.${requestDigest.slice(7, 23)}`,
    request_digest: requestDigest
  };
}
