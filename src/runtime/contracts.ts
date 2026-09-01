import type { PureTraceEvent } from "./pure-interpreter.js";

export const CAPABILITY_CONTRACT_VERSION = "1.0.0" as const;
export const APPROVAL_CONTRACT_VERSION = "1.0.0" as const;
export const RECEIPT_CONTRACT_VERSION = "1.0.0" as const;
export const CHECKPOINT_CONTRACT_VERSION = "1.0.0" as const;
export const RUN_CONTRACT_VERSION = "1.0.0" as const;
export const EPISODE_CONTRACT_VERSION = "1.0.0" as const;

export type EffectName = "repository_read" | "git_read" | "workspace_patch" | "process_run" | "human_approval";
export type ReceiptStatus = "prepared" | "executed" | "verified" | "failed" | "uncertain" | "compensated";
export type RunStatus = "prepared" | "running" | "completed" | "cancelled" | "failed" | "blocked";

export interface CapabilityRequest {
  contract_version: typeof CAPABILITY_CONTRACT_VERSION;
  request_id: string;
  run_id: string;
  program_digest: string;
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
  contract_version: typeof CAPABILITY_CONTRACT_VERSION;
  decision_id: string;
  request_id: string;
  decision: "granted" | "denied" | "approval_required";
  reasons: string[];
  policy_digest: string;
  approval_receipt_ref?: string;
  decided_at: string;
}

export interface CapabilityGrant {
  contract_version: typeof CAPABILITY_CONTRACT_VERSION;
  grant_id: string;
  request_id: string;
  request_digest: string;
  run_id: string;
  program_digest: string;
  node_id: string;
  adapter: string;
  action: string;
  resource: string;
  effects: EffectName[];
  capability: string;
  budget: CapabilityRequest["budget"];
  policy_digest: string;
  approval_receipt_ref?: string;
  issued_at: string;
  expires_at: string;
  opaque_token: string;
}

export interface ApprovalReceipt {
  contract_version: typeof APPROVAL_CONTRACT_VERSION;
  approval_id: string;
  approved: true;
  program_digest: string;
  sandbox_digest: string;
  effects: EffectName[];
  node_ids: string[];
  approver: string;
  issued_at: string;
  expires_at: string;
  canonical_write_allowed: false;
  signature_algorithm: "hmac-sha256-local";
  signature: string;
}

export interface EffectReceipt {
  contract_version: typeof RECEIPT_CONTRACT_VERSION;
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
  run: Omit<RuntimeRunRecord, "sandbox" | "approval_receipt_ref"> & { sandbox_ref: "redacted-host-local" };
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
  receipts: Array<Omit<EffectReceipt, "result" | "capability_grant_ref">>;
  exported_at: string;
  canonical_write_allowed: false;
  limitations: string[];
}
