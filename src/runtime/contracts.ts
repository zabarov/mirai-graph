import type { PureTraceEvent } from "./pure-interpreter.js";

export const CAPABILITY_CONTRACT_VERSION = "1.1.0" as const;
export const APPROVAL_CONTRACT_VERSION = "1.1.0" as const;
export const RECEIPT_CONTRACT_VERSION = "1.0.0" as const;
export const CHECKPOINT_CONTRACT_VERSION = "1.0.0" as const;
export const RUN_CONTRACT_VERSION = "1.0.0" as const;
export const EPISODE_CONTRACT_VERSION = "1.0.0" as const;
export const MANDATE_CONTRACT_VERSION = "1.0.0" as const;
export const INVARIANT_CONTRACT_VERSION = "1.0.0" as const;

export const TASK_CAPABILITY_CONTRACT_VERSION = "1.2.0" as const;
export const TASK_RECEIPT_CONTRACT_VERSION = "1.1.0" as const;
export const TASK_EFFECTS = ["task_control", "task_dispatch", "inference_invoke", "task_read"] as const;
export type TaskEffect = typeof TASK_EFFECTS[number];
export type EffectName = "repository_read" | "git_read" | "workspace_patch" | "process_run" | "human_approval" | TaskEffect;
export const hasTaskEffect = (effects: readonly string[]): boolean => effects.some(e => (TASK_EFFECTS as readonly string[]).includes(e));
export const capabilityContractFor = (effects: readonly string[]) => hasTaskEffect(effects) ? TASK_CAPABILITY_CONTRACT_VERSION : CAPABILITY_CONTRACT_VERSION;
export const receiptContractFor = (effects: readonly string[]) => hasTaskEffect(effects) ? TASK_RECEIPT_CONTRACT_VERSION : RECEIPT_CONTRACT_VERSION;
export const requiresTaskApproval = (effects: readonly string[]) => effects.some(e => e === "task_control" || e === "task_dispatch" || e === "inference_invoke");
export type ReceiptStatus = "prepared" | "executed" | "verified" | "failed" | "uncertain" | "compensated";
export type RunStatus = "prepared" | "running" | "completed" | "cancelled" | "failed" | "blocked";

export interface CapabilityRequest {
  contract_version: typeof CAPABILITY_CONTRACT_VERSION | typeof TASK_CAPABILITY_CONTRACT_VERSION;
  request_id: string;
  run_id: string;
  program_digest: string;
  input_digest: string;
  args_digest: string;
  node_id: string;
  adapter: string;
  action: string;
  resource: string;
  effects: EffectName[];
  capability: string;
  budget: { max_calls: number; max_bytes?: number; timeout_ms?: number };
  policy_digest: string;
  approval_required: boolean;
  request_digest: string;
}

export interface PolicyDecisionRecord {
  contract_version: CapabilityRequest["contract_version"];
  decision_id: string;
  request_id: string;
  decision: "granted" | "denied" | "approval_required";
  reasons: string[];
  policy_digest: string;
  approval_receipt_ref?: string;
  mandate_ref?: string;
  invariant_evaluation_digest?: string;
  decided_at: string;
}

export interface CapabilityGrant {
  contract_version: CapabilityRequest["contract_version"];
  grant_id: string;
  request_id: string;
  request_digest: string;
  run_id: string;
  program_digest: string;
  input_digest: string;
  args_digest: string;
  node_id: string;
  adapter: string;
  action: string;
  resource: string;
  effects: EffectName[];
  capability: string;
  budget: CapabilityRequest["budget"];
  policy_digest: string;
  approval_receipt_ref?: string;
  mandate_ref?: string;
  invariant_evaluation_digest?: string;
  issued_at: string;
  expires_at: string;
  opaque_token: string;
}

export interface MandateReceipt {
  contract_version: typeof MANDATE_CONTRACT_VERSION;
  mandate_id: string;
  status: "active" | "revoked";
  subject: string;
  issuer: string;
  run_id: string;
  program_digest: string;
  input_digest: string;
  policy_digest: string;
  request_scopes: ApprovalRequestScope[];
  issued_at: string;
  expires_at: string;
  revocation_ref?: string;
  canonical_write_allowed: false;
  signature_algorithm: "hmac-sha256-local";
  signature: string;
}

export type InvariantLayer = "system" | "organization" | "program" | "project" | "task";

export interface InvariantRule {
  id: string;
  layer: InvariantLayer;
  decision: "allow" | "deny";
  protected: boolean;
  adapters: string[];
  operations: string[];
  effects: EffectName[];
  resource_prefixes: string[];
  reason: string;
}

export interface LayeredInvariantSet {
  contract_version: typeof INVARIANT_CONTRACT_VERSION;
  id: string;
  version: string;
  rules: InvariantRule[];
  canonical_write_allowed: false;
  digest: string;
}

export interface InvariantEvaluationResult {
  contract_version: typeof INVARIANT_CONTRACT_VERSION;
  request_id: string;
  decision: "allowed" | "denied" | "unmatched";
  matched_rule_ids: string[];
  denied_rule_ids: string[];
  protected_rule_ids: string[];
  reasons: string[];
  canonical_write_allowed: false;
  digest: string;
}

export type ApprovalRequestScope = Omit<CapabilityRequest, "contract_version" | "request_id" | "request_digest" | "approval_required">;

export interface ApprovalReceipt {
  contract_version: typeof APPROVAL_CONTRACT_VERSION | typeof TASK_CAPABILITY_CONTRACT_VERSION;
  approval_id: string;
  approved: true;
  run_id: string;
  program_digest: string;
  input_digest: string;
  policy_digest: string;
  sandbox_digest: string;
  effects: EffectName[];
  node_ids: string[];
  request_scopes: ApprovalRequestScope[];
  approver: string;
  issued_at: string;
  expires_at: string;
  canonical_write_allowed: false;
  signature_algorithm: "hmac-sha256-local";
  signature: string;
}

export interface EffectReceipt {
  contract_version: typeof RECEIPT_CONTRACT_VERSION | typeof TASK_RECEIPT_CONTRACT_VERSION;
  receipt_id: string;
  sequence: number;
  idempotency_key: string;
  run_id: string;
  program_id: string;
  program_digest: string;
  node_id: string;
  invocation_id: string;
  adapter: string;
  operation: string;
  effects: EffectName[];
  capability_grant_ref: string;
  args_digest: string;
  status: ReceiptStatus;
  attempt: number;
  prepared_at: string;
  executed_at?: string;
  verified_at?: string;
  failed_at?: string;
  reconciled_at?: string;
  compensated_at?: string;
  result?: unknown;
  result_digest?: string;
  verification?: { status: "verified" | "not_verified" | "unsupported"; details: string[] };
  failure?: { code: string; message: string; retry_safe: boolean };
  compensation?: { status: "available" | "not_available" | "completed"; backup_ref?: string };
}

export interface RuntimeCheckpoint {
  contract_version: typeof CHECKPOINT_CONTRACT_VERSION;
  run_id: string;
  revision: number;
  status: RunStatus;
  event_sequence: number;
  verified_receipt_ids: string[];
  uncertain_receipt_ids: string[];
  updated_at: string;
  resume_strategy: "deterministic_restart_with_receipt_deduplication";
}

export interface RuntimeRunRecord {
  contract_version: typeof RUN_CONTRACT_VERSION;
  run_id: string;
  graph_id: string;
  program_id: string;
  program_digest: string;
  input_digest: string;
  sandbox: string;
  status: RunStatus;
  revision: number;
  event_sequence: number;
  apply_requested: boolean;
  approval_receipt_ref?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  blockers: string[];
  limitations: string[];
  program_ref: "program.json";
  input_ref: "input.json";
  checkpoint_ref: "checkpoint.json";
  episode_ref?: "episode.json";
}

export interface RuntimeEffectStub {
  sequence: number;
  receipt_id?: string;
  node_id: string;
  invocation_id: string;
  adapter: string;
  operation: string;
  args_digest: string;
  status: "verified" | "compensated" | "failed";
  result?: unknown;
  result_digest?: string;
  error_code?: string;
  error_message?: string;
}

export type RuntimeEffectSummary = Omit<RuntimeEffectStub, "result" | "error_message"> & {
  error_message_digest?: string;
};

export interface SanitizedEffectReceipt {
  contract_version: EffectReceipt["contract_version"];
  receipt_id: string;
  sequence: number;
  idempotency_key: string;
  run_id: string;
  program_id: string;
  program_digest: string;
  node_id: string;
  invocation_id: string;
  adapter: string;
  operation: string;
  effects: EffectName[];
  args_digest: string;
  status: ReceiptStatus;
  attempt: number;
  prepared_at: string;
  executed_at?: string;
  verified_at?: string;
  failed_at?: string;
  reconciled_at?: string;
  compensated_at?: string;
  result_digest?: string;
  verification_status?: "verified" | "not_verified" | "unsupported";
  failure_code?: string;
  failure_code_digest?: string;
  retry_safe?: boolean;
  compensation_status?: "available" | "not_available" | "completed";
  backup_ref?: "redacted-host-local";
}

export interface GovernedEpisode {
  contract_version: typeof EPISODE_CONTRACT_VERSION;
  episode_id: string;
  run_id: string;
  program_id: string;
  program_digest: string;
  input_digest: string;
  replay_input: Record<string, unknown>;
  status: "completed" | "cancelled";
  outputs: Record<string, unknown>;
  output_digest: string;
  final_state: Record<string, unknown>;
  emitted_events: Array<{ event: string; payload: unknown }>;
  trace: PureTraceEvent[];
  trace_digest: string;
  steps: number;
  logical_duration_ms: number;
  effects_executed: boolean;
  effect_stubs: RuntimeEffectStub[];
  receipt_refs: string[];
  policy_decision_refs: string[];
  checkpoint_ref: string;
  canonical_write_allowed: false;
  learning_update_allowed: false;
  limitations: string[];
}

export interface SanitizedEvidencePackage {
  contract_version: "1.0.0";
  run: {
    contract_version: "1.0.0";
    run_id: string;
    graph_id: string;
    program_id: string;
    program_digest: string;
    input_digest: string;
    status: RunStatus;
    revision: number;
    event_sequence: number;
    apply_requested: boolean;
    created_at: string;
    updated_at: string;
    started_at?: string;
    finished_at?: string;
    blocker_codes: string[];
    limitations: string[];
    program_ref: "program.json";
    input_ref: "input.json";
    checkpoint_ref: "checkpoint.json";
    episode_ref?: "episode.json";
    sandbox_ref: "redacted-host-local";
  };
  episode: {
    contract_version: "1.0.0";
    episode_id: string;
    run_id: string;
    program_id: string;
    program_digest: string;
    input_digest: string;
    status: "completed" | "cancelled";
    output_digest: string;
    trace_digest: string;
    steps: number;
    logical_duration_ms: number;
    effects_executed: boolean;
    replay_input_digest: string;
    effect_summaries: RuntimeEffectSummary[];
    canonical_write_allowed: false;
    learning_update_allowed: false;
    limitations: string[];
  };
  receipts: SanitizedEffectReceipt[];
  exported_at: string;
  canonical_write_allowed: false;
  limitations: string[];
}
