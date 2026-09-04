import type { TypeSpec, MiraiProgram } from "../program/types.js";
import type { GraphSnapshot, GraphView } from "../stdlib/types.js";

export interface TaskParticipant {
  id: string;
  object_ids: string[];
  source_ids: string[];
  delegate_to: string[];
}

export interface TaskPolicy {
  id: string;
  owner: string;
  reviewers: string[];
  participants: TaskParticipant[];
  max_depth: number;
  max_tasks: number;
  max_parallel: number;
  max_duration_ms: number;
  max_output_bytes: number;
  max_model_calls: number;
  digest: string;
}

export interface TaskDependency { task_id: string; requires: "verified" | "accepted" }

export interface TaskRequest {
  id: string;
  parent_id: string | null;
  receiver_id: string;
  receiver_digest: string;
  object_ids: string[];
  input: Record<string, unknown>;
  dependencies: TaskDependency[];
  required_evidence: string[];
  deadline: string;
  outcome: string;
  outcome_contract_ref?: string;
  outcome_contract_digest?: string;
}

export interface TaskPlan {
  contract_version: "1.0.0";
  id: string;
  graph_digest: string;
  policy_digest: string;
  catalog_digest: string;
  requests: TaskRequest[];
  canonical_write_allowed: false;
  digest: string;
}

export interface TaskProviderResult { output: Record<string, unknown>; evidence: Array<{ id: string; digest: string }> }
export interface TaskProviderContext {
  task_id: string;
  idempotency_key: string;
  signal: AbortSignal;
  view: GraphView;
  dependencies: Record<string, TaskProviderResult>;
}

export interface TaskReceiver {
  id: string;
  kind: "program" | "ai";
  digest: string;
  input_type: TypeSpec;
  output_type: TypeSpec;
  execute(input: Record<string, unknown>, context: TaskProviderContext): Promise<TaskProviderResult>;
}

export interface TaskRecord {
  request: TaskRequest;
  request_digest: string;
  input_snapshot_digest: string;
  idempotency_key: string;
  state: "submitted" | "running" | "blocked" | "completed" | "failed" | "cancelled";
  receipt_state: "prepared" | "executed" | "verified" | "failed" | "uncertain";
  acceptance: "pending" | "accepted" | "rejected";
  acceptance_receipt?: { reviewer: string; result_digest: string; decision_digest: string };
  result?: TaskProviderResult;
  result_digest?: string;
  blocker?: string;
}

export interface TaskLedger {
  contract_version: "1.0.0" | "1.1.0" | "1.2.0";
  history?: TaskHistoryEvent[];
  execution_scope?: string;
  plan: TaskPlan;
  graph_digest: string;
  policy_digest: string;
  receiver_catalog_digest: string;
  cancelled: boolean;
  reserved_model_calls: number;
  deadline_at: number;
  tasks: Record<string, TaskRecord>;
}

export type TaskHistoryKind = "reserve" | "deadline" | "output" | "verify" | "uncertain" | "accept" | "cancel" | "reconcile";
export interface TaskHistoryEvent {
  sequence: number;
  kind: TaskHistoryKind;
  previous_digest: string;
  before_digest: string;
  after_digest: string;
  changes: Record<string, Partial<TaskRecord>>;
  cancelled: boolean;
  reserved_model_calls: number;
  digest: string;
}

export interface TaskHostAuthorizationRequest {
  action: "create" | "dispatch" | "cancel" | "reconcile" | "accept";
  plan_digest: string;
  policy_digest: string;
  actor: string;
  task_id?: string;
  request_digest?: string;
  result_digest?: string;
  provider_kind?: TaskReceiver["kind"];
  verdict?: "accepted" | "rejected";
}

export interface TaskHostOptions {
  home: string;
  sandbox: string;
  graph: GraphSnapshot;
  policy: TaskPolicy;
  receivers: TaskReceiver[];
  authorize: (request: TaskHostAuthorizationRequest) => boolean;
  fault_injection?: "after_creation" | "after_reservation" | "after_output";
  execution_scope?: string;
}

export interface ProgramTaskReceiverOptions {
  id: string;
  program: MiraiProgram;
  evidence_id: string;
  programs?: Record<string, MiraiProgram>;
}
