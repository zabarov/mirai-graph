import { canonicalJson, digestValue } from "../core/canonical.js";
import { valueMatchesType } from "../program/validator.js";
import { requireCondition, requireJson, seal } from "../stdlib/graph.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import { assertTaskPlan, taskContextView, taskReceiverCatalogDigest } from "./contract.js";
import type { TaskLedger, TaskPolicy, TaskReceiver, TaskHistoryEvent, TaskHistoryKind, TaskRecord } from "./types.js";

export function taskLedgerProjection(value: TaskLedger): TaskLedger {
  if (value.contract_version !== "1.2.0") return structuredClone(value);
  const { history: _history, ...body } = structuredClone(value);
  return { ...body, contract_version: value.execution_scope ? "1.1.0" : "1.0.0" };
}

function initialLedger(value: TaskLedger): TaskLedger {
  const base = taskLedgerProjection(value);
  base.cancelled = false; base.reserved_model_calls = 0;
  base.tasks = Object.fromEntries(Object.entries(base.tasks).map(([id, task]) => [id, {
    request: task.request, request_digest: task.request_digest, input_snapshot_digest: task.input_snapshot_digest,
    idempotency_key: task.idempotency_key, state: "submitted", receipt_state: "prepared", acceptance: "pending"
  }]));
  return base;
}

/** The history and current state are committed in the same extension CAS write. */
export function appendTaskHistory(before: TaskLedger, after: TaskLedger, kind: TaskHistoryKind): void {
  if (before.contract_version !== "1.2.0") return;
  const left = taskLedgerProjection(before), right = taskLedgerProjection(after);
  if (digestValue(left) === digestValue(right)) return;
  const changes: Record<string, Partial<TaskRecord>> = {};
  for (const [id, task] of Object.entries(right.tasks)) {
    const delta = Object.fromEntries(Object.entries(task).filter(([key, value]) => canonicalJson(value) !== canonicalJson((left.tasks[id] as unknown as Record<string, unknown>)[key] ?? null)));
    if (Object.keys(delta).length) changes[id] = delta;
  }
  const history = before.history!;
  after.history = [...history, seal({ sequence: history.length + 1, kind,
    previous_digest: history.at(-1)?.digest ?? digestValue(initialLedger(before)),
    before_digest: digestValue(left), after_digest: digestValue(right), changes,
    cancelled: after.cancelled, reserved_model_calls: after.reserved_model_calls })];
}

function checkTransition(before: TaskLedger, after: TaskLedger, event: TaskHistoryEvent, receivers: TaskReceiver[]): void {
  const ids = Object.keys(event.changes);
  const is = (t: TaskRecord, state: string, receipt: string) => t.state === state && t.receipt_state === receipt;
  const fields: Record<TaskHistoryKind, string[]> = {
    reserve: ["state"], deadline: ["state", "blocker"], output: ["result", "result_digest", "receipt_state"],
    verify: ["state", "receipt_state"], reconcile: ["state", "receipt_state"],
    uncertain: ["state", "receipt_state", "blocker"], accept: ["acceptance", "acceptance_receipt"], cancel: ["state", "receipt_state"]
  };
  requireCondition(Object.hasOwn(fields, event.kind) && (event.kind === "cancel" || ids.length === 1), "task_history_operation_invalid");
  requireCondition(event.kind === "cancel" ? !before.cancelled && after.cancelled : before.cancelled === after.cancelled, "task_history_cancel_invalid");
  let reservations = 0;
  for (const id of ids) {
    const prev = before.tasks[id], next = after.tasks[id];
    requireCondition(prev && next && Object.keys(event.changes[id]!).every(k => fields[event.kind].includes(k)), "task_history_change_invalid");
    if (event.kind === "reserve") {
      requireCondition(!before.cancelled && is(prev, "submitted", "prepared") && is(next, "running", "prepared"), "task_history_reserve_invalid");
      if (receivers.find(r => r.id === prev.request.receiver_id)!.kind === "ai") reservations++;
    } else if (event.kind === "deadline") requireCondition(!before.cancelled && is(prev, "submitted", "prepared") && is(next, "blocked", "prepared") && next.blocker === "task_deadline_expired", "task_history_deadline_invalid");
    else if (event.kind === "output") requireCondition(!before.cancelled && is(prev, "running", "prepared") && is(next, "running", "executed"), "task_history_output_invalid");
    else if (event.kind === "verify" || event.kind === "reconcile") requireCondition(!before.cancelled && is(prev, "running", "executed") && is(next, "completed", "verified"), "task_history_verify_invalid");
    else if (event.kind === "accept") requireCondition(!before.cancelled && is(prev, "completed", "verified") && prev.acceptance === "pending" && next.acceptance !== "pending", "task_history_accept_invalid");
    else if (event.kind === "uncertain") requireCondition((prev.state === "running" || (before.cancelled && prev.state === "cancelled")) && next.state === (before.cancelled ? "cancelled" : "blocked") && next.receipt_state === "uncertain", "task_history_uncertain_invalid");
    else requireCondition((prev.state === "submitted" && is(next, "cancelled", "prepared")) || (prev.state === "running" && is(next, "cancelled", "uncertain")), "task_history_cancel_change_invalid");
  }
  if (event.kind === "cancel") requireCondition(Object.values(after.tasks).every(t => !["submitted", "running"].includes(t.state)), "task_history_cancel_incomplete");
  requireCondition(after.reserved_model_calls === before.reserved_model_calls + reservations, "task_history_reservation_invalid");
}

function verifyTaskHistory(ledger: TaskLedger, graph: GraphSnapshot, policy: TaskPolicy, receivers: TaskReceiver[]): void {
  requireCondition(Array.isArray(ledger.history) && ledger.history.length <= policy.max_tasks * 6 + 2, "task_history_budget_invalid");
  let state = initialLedger(ledger), previous = digestValue(state);
  verifyTaskLedger(state, graph, policy, receivers);
  for (const [index, event] of ledger.history.entries()) {
    requireCondition(Object.keys(event).sort().join(",") === "after_digest,before_digest,cancelled,changes,digest,kind,previous_digest,reserved_model_calls,sequence", "task_history_shape_invalid");
    const { digest, ...body } = event;
    requireCondition(digest === digestValue(body) && event.sequence === index + 1 && event.previous_digest === previous && event.before_digest === digestValue(state), "task_history_chain_invalid");
    const next = structuredClone(state);
    requireCondition(event.changes && !Array.isArray(event.changes) && typeof event.changes === "object", "task_history_changes_invalid");
    for (const [id, delta] of Object.entries(event.changes)) {
      requireCondition(next.tasks[id] && delta && typeof delta === "object" && !Array.isArray(delta), "task_history_task_unknown");
      Object.assign(next.tasks[id]!, delta);
    }
    next.cancelled = event.cancelled; next.reserved_model_calls = event.reserved_model_calls;
    checkTransition(state, next, event, receivers);
    verifyTaskLedger(next, graph, policy, receivers);
    requireCondition(event.after_digest === digestValue(next), "task_history_state_digest_invalid");
    state = next; previous = digest;
  }
  requireCondition(digestValue(state) === digestValue(taskLedgerProjection(ledger)), "task_history_final_state_mismatch");
}

export interface TaskReplayRecord {
  contract_version: "1.0.0";
  ledger: TaskLedger;
  canonical_write_allowed: false;
  digest: string;
}

/** Structural replay of recorded results. Never calls receivers or grants authority. */
export function verifyTaskLedger(ledger: TaskLedger, graph: GraphSnapshot, policy: TaskPolicy, receivers: TaskReceiver[]): void {
  requireJson(ledger);
  if (ledger.contract_version === "1.2.0") {
    requireCondition(Object.hasOwn(ledger, "history"), "task_history_missing");
    const base = taskLedgerProjection(ledger);
    verifyTaskLedger(base, graph, policy, receivers);
    verifyTaskHistory(ledger, graph, policy, receivers);
    return;
  }
  const scoped = ledger.contract_version === "1.1.0";
  requireCondition(Object.keys(ledger).sort().join(",") === (scoped ? "cancelled,contract_version,deadline_at,execution_scope,graph_digest,plan,policy_digest,receiver_catalog_digest,reserved_model_calls,tasks" : "cancelled,contract_version,deadline_at,graph_digest,plan,policy_digest,receiver_catalog_digest,reserved_model_calls,tasks"), "task_ledger_shape_invalid");
  requireCondition((scoped || ledger.contract_version === "1.0.0") && typeof ledger.cancelled === "boolean" && Number.isSafeInteger(ledger.deadline_at) && ledger.deadline_at > 0, "task_ledger_metadata_invalid");
  if (scoped) requireCondition(typeof ledger.execution_scope === "string" && /^sha256:[a-f0-9]{64}$/.test(ledger.execution_scope), "task_execution_scope_invalid");
  assertTaskPlan(ledger.plan, graph, policy, receivers);
  requireCondition(ledger.graph_digest === graph.digest && ledger.policy_digest === policy.digest && ledger.receiver_catalog_digest === taskReceiverCatalogDigest(receivers), "task_replay_binding_mismatch");
  requireCondition(Number.isSafeInteger(ledger.reserved_model_calls) && ledger.reserved_model_calls >= 0 && ledger.reserved_model_calls <= policy.max_model_calls, "task_replay_budget_invalid");
  requireCondition(Object.keys(ledger.tasks).sort().join(",") === ledger.plan.requests.map(r => r.id).sort().join(","), "task_replay_inventory_mismatch");
  let requiredModelReservations = 0;
  for (const request of ledger.plan.requests) {
    const task = ledger.tasks[request.id]!;
    const receiver = receivers.find(r => r.id === request.receiver_id)!;
    requireCondition(Object.keys(task).every(key => ["request", "request_digest", "input_snapshot_digest", "idempotency_key", "state", "receipt_state", "acceptance", "acceptance_receipt", "result", "result_digest", "blocker"].includes(key)), "task_replay_record_field_invalid");
    requireCondition(canonicalJson(task.request) === canonicalJson(request) && task.request_digest === digestValue(request), "task_replay_request_mismatch");
    requireCondition(task.input_snapshot_digest === taskContextView(graph, policy, request, ledger.plan.requests).digest, "task_replay_snapshot_mismatch");
    requireCondition(task.idempotency_key === digestValue({ plan: ledger.plan.digest, task: request.id, request: task.request_digest, ...(scoped ? { execution_scope: ledger.execution_scope } : {}) }), "task_replay_idempotency_mismatch");
    requireCondition(["submitted", "running", "blocked", "completed", "failed", "cancelled"].includes(task.state) && ["prepared", "executed", "verified", "failed", "uncertain"].includes(task.receipt_state) && ["pending", "accepted", "rejected"].includes(task.acceptance), "task_replay_state_invalid");
    requireCondition(task.blocker === undefined || /^task_[a-z_]+$/.test(task.blocker), "task_replay_blocker_invalid");
    if (task.state === "running" || task.receipt_state !== "prepared") {
      if (receiver.kind === "ai") requiredModelReservations++;
    }
    if (task.result !== undefined) {
      const result = task.result;
      requireCondition(Object.keys(result).sort().join(",") === "evidence,output" && Buffer.byteLength(JSON.stringify(result)) <= policy.max_output_bytes, "task_replay_result_invalid");
      requireCondition(valueMatchesType(result.output, receiver.output_type), "task_replay_output_type_mismatch");
      requireCondition(digestValue(result) === task.result_digest, "task_replay_result_digest_mismatch");
      requireCondition(Array.isArray(result.evidence) && result.evidence.length <= 64 && new Set(result.evidence.map(e => e.id)).size === result.evidence.length, "task_replay_evidence_invalid");
      requireCondition(result.evidence.every(e => Object.keys(e).sort().join(",") === "digest,id" && /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/.test(e.id) && /^sha256:[a-f0-9]{64}$/.test(e.digest)), "task_replay_evidence_invalid");
      requireCondition(request.required_evidence.every(id => result.evidence.some(e => e.id === id)), "task_replay_required_evidence_missing");
      requireCondition(!["submitted", "failed"].includes(task.state), "task_replay_result_state_invalid");
    } else {
      requireCondition(task.result_digest === undefined && !["executed", "verified"].includes(task.receipt_state), "task_replay_result_missing");
    }
    requireCondition(task.state !== "completed" || task.receipt_state === "verified", "task_replay_completion_unverified");
    requireCondition(task.receipt_state !== "verified" || task.state === "completed", "task_replay_verified_state_invalid");
    if (task.state === "submitted") requireCondition(task.receipt_state === "prepared", "task_replay_submitted_state_invalid");
    if (task.acceptance !== "pending") {
      requireCondition(task.state === "completed" && task.receipt_state === "verified" && task.acceptance_receipt, "task_replay_acceptance_without_result");
      const receipt = task.acceptance_receipt;
      requireCondition(Object.keys(receipt).sort().join(",") === "decision_digest,result_digest,reviewer", "task_replay_acceptance_shape_invalid");
      requireCondition(policy.reviewers.includes(receipt.reviewer) && receipt.reviewer !== request.receiver_id && receipt.result_digest === task.result_digest, "task_replay_reviewer_invalid");
      requireCondition(receipt.decision_digest === digestValue({ reviewer: receipt.reviewer, task_id: request.id, result_digest: task.result_digest, verdict: task.acceptance, plan_digest: ledger.plan.digest }), "task_replay_acceptance_digest_mismatch");
    } else requireCondition(task.acceptance_receipt === undefined, "task_replay_pending_receipt_invalid");
    if (task.result || task.state === "running") {
      for (const dependency of request.dependencies) {
        const previous = ledger.tasks[dependency.task_id]!;
        requireCondition(previous.state === "completed" && previous.receipt_state === "verified" && (dependency.requires !== "accepted" || previous.acceptance === "accepted"), "task_replay_dependency_unsatisfied");
      }
    }
  }
  requireCondition(ledger.reserved_model_calls >= requiredModelReservations, "task_replay_reservation_missing");
  requireCondition(Object.values(ledger.tasks).filter(t => t.state === "running").length <= policy.max_parallel, "task_replay_parallel_budget_exceeded");
}

export function createTaskReplayRecord(ledger: TaskLedger, graph: GraphSnapshot, policy: TaskPolicy, receivers: TaskReceiver[], history = false): TaskReplayRecord {
  verifyTaskLedger(ledger, graph, policy, receivers);
  return seal({ contract_version: "1.0.0" as const, ledger: history ? structuredClone(ledger) : taskLedgerProjection(ledger), canonical_write_allowed: false as const });
}

export function replayTasks(record: TaskReplayRecord, graph: GraphSnapshot, policy: TaskPolicy, receivers: TaskReceiver[]) {
  requireJson(record);
  requireCondition(Object.keys(record).sort().join(",") === "canonical_write_allowed,contract_version,digest,ledger" && record.contract_version === "1.0.0" && record.canonical_write_allowed === false, "task_replay_record_invalid");
  const { digest, ...body } = record;
  requireCondition(digestValue(body) === digest, "task_replay_digest_mismatch");
  verifyTaskLedger(record.ledger, graph, policy, receivers);
  const ledger = record.ledger;
  const decisions = ledger.plan.requests.map(request => {
    const task = ledger.tasks[request.id]!;
    return { task_id: request.id, state: task.state, receipt_state: task.receipt_state, acceptance: task.acceptance,
      result_digest: task.result_digest ?? null, decision_digest: task.acceptance_receipt?.decision_digest ?? null };
  });
  return seal({ contract_version: "1.0.0", plan_digest: ledger.plan.digest, decisions,
    recorded_completion: !ledger.cancelled && decisions.every(d => d.state === "completed" && d.receipt_state === "verified" && d.acceptance === "accepted"),
    verification: ledger.contract_version === "1.2.0" ? "chronological_recorded_transitions" : "structural_recorded_results", provider_calls: 0, authority_verified: false,
    canonical_write_allowed: false });
}
