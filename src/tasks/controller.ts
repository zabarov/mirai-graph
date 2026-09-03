import { digestValue } from "../core/canonical.js";
import { compileProgramSource } from "../program/compiler.js";
import { valueMatchesType } from "../program/validator.js";
import { RunStore } from "../runtime/store.js";
import { assertSnapshot, lexical, requireCondition, requireJson, seal } from "../stdlib/graph.js";
import { assertTaskPlan, assertTaskPolicy, taskContextView, taskReceiverCatalogDigest } from "./contract.js";
import type { TaskHostOptions, TaskHostAuthorizationRequest, TaskLedger, TaskPlan, TaskPolicy, TaskProviderResult, TaskReceiver, TaskRecord, TaskHistoryKind } from "./types.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import { createTaskReplayRecord, verifyTaskLedger, appendTaskHistory } from "./replay.js";

const EXTENSION = "task-ledger";

function coordinatorProgram() {
  return compileProgramSource(JSON.stringify({ id: "mirai.task_coordinator", version: "1.0.0", entry: "done",
    nodes: [{ id: "done", kind: "return", values: {} }],
    policies: { budgets: { max_steps: 1, max_depth: 1, max_iterations: 1, max_parallel: 1, max_duration_ms: 1000 }, allowed_effects: ["pure"], canonical_write_allowed: false }
  }), "coordinator.mirai.json").program;
}

export class TaskHost {
  private readonly store: RunStore;
  private readonly graph: GraphSnapshot;
  private readonly policy: TaskPolicy;
  private readonly receivers: Map<string, TaskReceiver>;
  private readonly authorize: TaskHostOptions["authorize"];
  private readonly receiverDigest: string;
  private readonly controllers = new Map<string, AbortController>();
  private readonly taskLeases = new Map<string, { token: string; users: number }>();
  private readonly sandbox: string;
  private readonly fault: TaskHostOptions["fault_injection"];
  private readonly executionScope: string | undefined;

  constructor(options: TaskHostOptions) {
    assertSnapshot(options.graph); assertTaskPolicy(options.policy);
    requireCondition(typeof options.authorize === "function", "task_host_authorization_required");
    this.graph = structuredClone(options.graph); this.policy = structuredClone(options.policy);
    taskReceiverCatalogDigest(options.receivers);
    requireCondition(options.receivers.every(r => typeof r.execute === "function"), "task_receiver_executor_required");
    this.receivers = new Map(options.receivers.map(r => [r.id, { ...r, input_type: structuredClone(r.input_type), output_type: structuredClone(r.output_type) }]));
    this.receiverDigest = taskReceiverCatalogDigest([...this.receivers.values()]);
    this.authorize = options.authorize; this.sandbox = options.sandbox; this.fault = options.fault_injection;
    requireCondition(options.execution_scope === undefined || /^sha256:[a-f0-9]{64}$/.test(options.execution_scope), "task_execution_scope_invalid");
    this.executionScope = options.execution_scope;
    this.store = new RunStore(options.home, { create: false });
  }

  private permit(request: TaskHostAuthorizationRequest): void {
    requireCondition(this.authorize(structuredClone(request)) === true, "task_host_authorization_denied");
  }

  private read(runId: string) {
    const state = this.store.readExtensionState<TaskLedger>(runId, EXTENSION);
    requireCondition(state, "task_ledger_missing");
    requireCondition(state.value.graph_digest === this.graph.digest && state.value.policy_digest === this.policy.digest && state.value.receiver_catalog_digest === this.receiverDigest, "task_host_binding_mismatch");
    requireCondition(state.value.execution_scope === this.executionScope, "task_execution_scope_mismatch");
    verifyTaskLedger(state.value, this.graph, this.policy, [...this.receivers.values()]);
    return state;
  }

  private update(runId: string, kind: TaskHistoryKind, change: (state: TaskLedger) => void): TaskLedger {
    const current = this.read(runId);
    return this.store.updateExtensionState<TaskLedger>(runId, EXTENSION, current.digest, value => {
      requireCondition(value, "task_ledger_missing");
      const before = structuredClone(value);
      change(value);
      appendTaskHistory(before, value, kind);
      verifyTaskLedger(value, this.graph, this.policy, [...this.receivers.values()]);
      return value;
    }).value;
  }

  runId(plan: TaskPlan): string {
    return `tasks.${(this.executionScope ? digestValue({ plan: plan.digest, execution_scope: this.executionScope }) : plan.digest).slice(7)}`;
  }

  create(plan: TaskPlan): string {
    assertTaskPlan(plan, this.graph, this.policy, [...this.receivers.values()]);
    this.permit({ action: "create", actor: this.policy.owner, plan_digest: plan.digest, policy_digest: this.policy.digest });
    const runId = this.runId(plan);
    if (this.store.listRunIds().includes(runId)) { this.read(runId); return runId; }
    const now = Date.now();
    requireCondition(plan.requests.every(r => Date.parse(r.deadline) > now), "task_deadline_expired");
    const tasks: Record<string, TaskRecord> = Object.fromEntries(plan.requests.map(request => [request.id, {
      request: structuredClone(request), request_digest: digestValue(request),
      input_snapshot_digest: taskContextView(this.graph, this.policy, request, plan.requests).digest,
      idempotency_key: digestValue({ plan: plan.digest, task: request.id, request: digestValue(request), ...(this.executionScope ? { execution_scope: this.executionScope } : {}) }),
      state: "submitted", receipt_state: "prepared", acceptance: "pending"
    }]));
    const ledger: TaskLedger = {
      contract_version: "1.2.0", history: [], ...(this.executionScope ? { execution_scope: this.executionScope } : {}), plan: structuredClone(plan), graph_digest: this.graph.digest,
      policy_digest: this.policy.digest, receiver_catalog_digest: this.receiverDigest,
      cancelled: false, reserved_model_calls: 0, deadline_at: now + this.policy.max_duration_ms, tasks
    };
    this.store.createRun({ program: coordinatorProgram(), input: { plan_digest: plan.digest }, sandbox: this.sandbox,
      apply: false, run_id: runId, runtime_config: { kind: "task_coordinator", receiver_catalog_digest: this.receiverDigest },
      initial_extensions: { [EXTENSION]: ledger } });
    if (this.fault === "after_creation") throw new Error("task_injected_crash_after_creation");
    return runId;
  }

  inspect(runId: string): TaskLedger { return structuredClone(this.read(runId).value); }

  replayRecord(runId: string) {
    return createTaskReplayRecord(this.read(runId).value, this.graph, this.policy, [...this.receivers.values()]);
  }

  historyReplayRecord(runId: string) {
    return createTaskReplayRecord(this.read(runId).value, this.graph, this.policy, [...this.receivers.values()], true);
  }

  private checkResult(task: TaskRecord, result: TaskProviderResult): void {
    requireJson(result);
    requireCondition(result && Object.keys(result).sort().join(",") === "evidence,output", "task_result_shape_invalid");
    requireCondition(Buffer.byteLength(JSON.stringify(result)) <= this.policy.max_output_bytes, "task_output_budget_exceeded");
    const receiver = this.receivers.get(task.request.receiver_id)!;
    requireCondition(valueMatchesType(result.output, receiver.output_type), "task_output_type_mismatch");
    requireCondition(Array.isArray(result.evidence) && result.evidence.length <= 64 && new Set(result.evidence.map(e => e.id)).size === result.evidence.length, "task_evidence_invalid");
    requireCondition(result.evidence.every(e => Object.keys(e).sort().join(",") === "digest,id" && /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/.test(e.id) && /^sha256:[a-f0-9]{64}$/.test(e.digest)), "task_evidence_invalid");
    requireCondition(task.request.required_evidence.every(id => result.evidence.some(e => e.id === id)), "task_required_evidence_missing");
  }

  private async dispatch(runId: string, taskId: string, signal?: AbortSignal): Promise<void> {
    requireCondition(!signal?.aborted, "task_cancelled");
    const current = this.read(runId).value;
    const task = current.tasks[taskId]!;
    const receiver = this.receivers.get(task.request.receiver_id)!;
    const deadline = Math.min(current.deadline_at, Date.parse(task.request.deadline));
    if (deadline <= Date.now()) {
      this.update(runId, "deadline", state => { state.tasks[taskId]!.state = "blocked"; state.tasks[taskId]!.blocker = "task_deadline_expired"; }); return;
    }
    this.permit({ action: "dispatch", actor: receiver.id, task_id: taskId, request_digest: task.request_digest,
      plan_digest: current.plan.digest, policy_digest: this.policy.digest, provider_kind: receiver.kind });
    this.update(runId, "reserve", state => {
      const record = state.tasks[taskId]!;
      requireCondition(!state.cancelled && record.state === "submitted", "task_not_dispatchable");
      requireCondition(Object.values(state.tasks).filter(t => t.state === "running").length < this.policy.max_parallel, "task_parallel_budget_exceeded");
      if (receiver.kind === "ai") {
        requireCondition(state.reserved_model_calls < this.policy.max_model_calls, "task_model_budget_exceeded");
        state.reserved_model_calls++;
      }
      record.state = "running"; record.receipt_state = "prepared";
    });
    if (this.fault === "after_reservation") throw new Error("task_injected_crash_after_reservation");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    this.controllers.set(`${runId}:${taskId}`, controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const dependencies = Object.fromEntries(task.request.dependencies.map(d => [d.task_id, structuredClone(current.tasks[d.task_id]!.result!)]));
      const response = await Promise.race([
        receiver.execute(structuredClone(task.request.input), { task_id: taskId, idempotency_key: task.idempotency_key,
          signal: controller.signal, view: taskContextView(this.graph, this.policy, task.request, current.plan.requests), dependencies }),
        new Promise<never>((_, reject) => {
          const aborted = () => reject(new Error("task_cancelled"));
          if (controller.signal.aborted) aborted();
          else controller.signal.addEventListener("abort", aborted, { once: true });
        }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error("task_execution_timeout")); controller.abort(); }, Math.max(1, deadline - Date.now())); })
      ]);
      requireCondition(Date.now() < deadline && !controller.signal.aborted, "task_execution_timeout");
      this.checkResult(task, response);
      const result = structuredClone(response);
      result.evidence.sort((a, b) => lexical(a.id, b.id));
      this.update(runId, "output", state => {
        requireCondition(!state.cancelled && !controller.signal.aborted, "task_cancelled");
        const record = state.tasks[taskId]!;
        record.result = result; record.result_digest = digestValue(result); record.receipt_state = "executed";
      });
      if (this.fault === "after_output") throw new Error("task_injected_crash_after_output");
      this.update(runId, "verify", state => { const record = state.tasks[taskId]!; record.state = "completed"; record.receipt_state = "verified"; });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("task_injected_crash")) throw error;
      this.update(runId, "uncertain", state => {
        const record = state.tasks[taskId]!;
        const code = error instanceof Error && /^task_[a-z_]+$/.test(error.message) ? error.message : "task_provider_failed";
        record.state = state.cancelled ? "cancelled" : "blocked";
        record.receipt_state = "uncertain"; record.blocker = code;
      });
    } finally {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      controller.abort(); this.controllers.delete(`${runId}:${taskId}`);
    }
  }

  /** Exactly one provider call, sharing a lease only with this trusted host. */
  async runTask(runId: string, taskId: string, kind: TaskReceiver["kind"], signal?: AbortSignal): Promise<TaskRecord> {
    const existing = this.taskLeases.get(runId);
    const lease = existing || { token: this.store.acquireLease(runId, this.policy.max_duration_ms + 1000).token, users: 0 };
    lease.users++; this.taskLeases.set(runId, lease);
    try {
      const state = this.read(runId).value;
      const task = state.tasks[taskId];
      requireCondition(task && this.receivers.get(task.request.receiver_id)?.kind === kind, "task_receiver_kind_mismatch");
      requireCondition(!state.cancelled, "task_cancelled");
      if (task.state === "completed" && task.receipt_state === "verified") return structuredClone(task);
      requireCondition(!Object.values(state.tasks).some(t => t.receipt_state === "uncertain" || t.receipt_state === "executed"), "task_reconcile_required");
      requireCondition(task.state === "submitted", "task_not_dispatchable");
      requireCondition(task.request.dependencies.every(d => {
        const prior = state.tasks[d.task_id]!;
        return prior.state === "completed" && prior.receipt_state === "verified" && (d.requires !== "accepted" || prior.acceptance === "accepted");
      }), "task_dependency_not_ready");
      await this.dispatch(runId, taskId, signal);
      const result = this.inspect(runId).tasks[taskId]!;
      requireCondition(result.state === "completed" && result.receipt_state === "verified", "task_reconcile_required");
      return result;
    } finally {
      if (--lease.users === 0) { this.taskLeases.delete(runId); this.store.releaseLease(runId, lease.token); }
    }
  }

  async runReady(runId: string): Promise<TaskLedger> {
    requireCondition(!this.taskLeases.has(runId), "task_dispatch_already_running");
    const initial = this.read(runId).value;
    if (initial.cancelled) return structuredClone(initial);
    const lease = this.store.acquireLease(runId, this.policy.max_duration_ms + 1000);
    try {
      requireCondition(!Object.values(initial.tasks).some(t => t.state === "running" || t.receipt_state === "uncertain" || t.receipt_state === "executed"), "task_reconcile_required");
      while (true) {
        const state = this.read(runId).value;
        if (state.cancelled) break;
        if (Object.values(state.tasks).some(t => t.receipt_state === "uncertain" || t.receipt_state === "executed")) break;
        const ready = Object.values(state.tasks).filter(t => t.state === "submitted" && t.request.dependencies.every(d => {
          const previous = state.tasks[d.task_id]!;
          return previous.receipt_state === "verified" && previous.state === "completed" && (d.requires !== "accepted" || previous.acceptance === "accepted");
        })).sort((a, b) => lexical(a.request.id, b.request.id)).slice(0, this.policy.max_parallel);
        if (!ready.length) break;
        const outcomes = await Promise.allSettled(ready.map(task => this.dispatch(runId, task.request.id)));
        const failure = outcomes.find(x => x.status === "rejected") as PromiseRejectedResult | undefined;
        if (failure) throw failure.reason;
      }
      return this.inspect(runId);
    } finally { this.store.releaseLease(runId, lease.token); }
  }

  accept(runId: string, taskId: string, reviewer: string, resultDigest: string, verdict: "accepted" | "rejected"): TaskRecord {
    const state = this.read(runId).value;
    const task = state.tasks[taskId];
    requireCondition(task && this.policy.reviewers.includes(reviewer) && reviewer !== task.request.receiver_id, "task_reviewer_not_allowed");
    requireCondition(["accepted", "rejected"].includes(verdict), "task_acceptance_verdict_invalid");
    requireCondition(!state.cancelled && task.state === "completed" && task.receipt_state === "verified" && task.result_digest === resultDigest, "task_acceptance_result_mismatch");
    this.checkResult(task, task.result!);
    this.permit({ action: "accept", actor: reviewer, task_id: taskId, result_digest: resultDigest,
      request_digest: task.request_digest, plan_digest: state.plan.digest, policy_digest: this.policy.digest, verdict });
    const decision = seal({ reviewer, task_id: taskId, result_digest: resultDigest, verdict, plan_digest: state.plan.digest });
    this.update(runId, "accept", value => {
      const record = value.tasks[taskId]!;
      requireCondition(!value.cancelled && record.state === "completed" && record.receipt_state === "verified" && record.result_digest === resultDigest, "task_acceptance_result_mismatch");
      requireCondition(record.acceptance === "pending" || record.acceptance_receipt?.decision_digest === decision.digest, "task_acceptance_already_decided");
      record.acceptance = verdict;
      record.acceptance_receipt = { reviewer, result_digest: resultDigest, decision_digest: decision.digest };
    });
    return this.inspect(runId).tasks[taskId]!;
  }

  cancel(runId: string, actor: string): void {
    const state = this.read(runId).value;
    requireCondition(actor === this.policy.owner, "task_cancel_owner_required");
    this.permit({ action: "cancel", actor, plan_digest: state.plan.digest, policy_digest: this.policy.digest });
    this.update(runId, "cancel", ledger => {
      ledger.cancelled = true;
      for (const record of Object.values(ledger.tasks)) {
        if (record.state === "submitted") record.state = "cancelled";
        if (record.state === "running") { record.state = "cancelled"; record.receipt_state = "uncertain"; }
      }
    });
    for (const [id, controller] of this.controllers) if (id.startsWith(`${runId}:`)) controller.abort();
  }

  reconcileRecordedOutput(runId: string, taskId: string, actor: string): TaskRecord {
    const state = this.read(runId).value;
    requireCondition(actor === this.policy.owner, "task_reconcile_owner_required");
    const task = state.tasks[taskId];
    requireCondition(task?.result && task.receipt_state === "executed" && digestValue(task.result) === task.result_digest, "task_reconcile_evidence_missing");
    this.permit({ action: "reconcile", actor, task_id: taskId, result_digest: task.result_digest,
      request_digest: task.request_digest, plan_digest: state.plan.digest, policy_digest: this.policy.digest });
    this.checkResult(task, task.result);
    this.update(runId, "reconcile", ledger => {
      requireCondition(!ledger.cancelled, "task_cancelled");
      const record = ledger.tasks[taskId]!;
      requireCondition(record.receipt_state === "executed" && record.result_digest === task.result_digest, "task_reconcile_result_changed");
      record.receipt_state = "verified"; record.state = "completed";
    });
    return this.inspect(runId).tasks[taskId]!;
  }

  collect(runId: string) {
    const state = this.read(runId).value;
    const tasks = Object.values(state.tasks).sort((a, b) => lexical(a.request.id, b.request.id));
    const results = tasks.map(t => ({ task_id: t.request.id, state: t.state, receipt_state: t.receipt_state, acceptance: t.acceptance,
      ...(t.result_digest ? { result_digest: t.result_digest } : {}), ...(t.blocker ? { blocker: t.blocker } : {}) }));
    return seal({ plan_digest: state.plan.digest, status: !state.cancelled && tasks.every(t => t.state === "completed" && t.receipt_state === "verified" && t.acceptance === "accepted") ? "accepted" : "incomplete",
      results, reserved_model_calls: state.reserved_model_calls, canonical_write_allowed: false });
  }
}
