import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { digestValue } from "../core/canonical.js";
import type { AdapterRegistry, AdapterExecutionContext } from "../adapters/types.js";
import { validateGrant } from "../runtime/capabilities.js";
import { verifyApprovalReceipt } from "../runtime/approval.js";
import { requiresTaskApproval } from "../runtime/contracts.js";
import { RunStore } from "../runtime/store.js";
import { requireCondition, seal } from "../stdlib/graph.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import { assertTaskPlan, taskReceiverCatalogDigest } from "./contract.js";
import { TaskHost } from "./controller.js";
import type { TaskHostAuthorizationRequest, TaskPlan, TaskPolicy, TaskReceiver } from "./types.js";
import { TASK_OPERATIONS, validateTaskArguments } from "./operations.js";

export interface TaskRuntimeRegistry {
  graph: GraphSnapshot;
  policy: TaskPolicy;
  plans: TaskPlan[];
  receivers: TaskReceiver[];
}

export function taskRuntimeRegistryDigest(registry: TaskRuntimeRegistry): string {
  requireCondition(registry.plans.length === 1, "task_registry_requires_one_budget_root");
  requireCondition(new Set(registry.plans.map(p => p.digest)).size === registry.plans.length, "task_registry_duplicate_plan");
  for (const plan of registry.plans) assertTaskPlan(plan, registry.graph, registry.policy, registry.receivers);
  return digestValue({ graph: registry.graph.digest, policy: registry.policy.digest, operation_contract_digest: digestValue(TASK_OPERATIONS),
    plans: registry.plans.map(p => p.digest).sort(), receivers: taskReceiverCatalogDigest(registry.receivers) });
}

export function taskOperationResource(operation: string, args: Record<string, unknown>): string {
  validateTaskArguments(operation, args);
  return `mirai-task:${args.registry_digest}/${args.plan_digest}/${args.task_id || "root"}/${operation}`;
}

function runtimeTaskHost(registry: TaskRuntimeRegistry, registryDigest: string, store: RunStore, runId: string,
  sandbox: string, authorize: (r: TaskHostAuthorizationRequest) => boolean): TaskHost {
  return new TaskHost({ home: path.join(store.directory(runId), "task-hosts", registryDigest.slice(7)), sandbox,
    graph: registry.graph, policy: registry.policy, receivers: registry.receivers,
    execution_scope: digestValue({ home: store.home, run_id: runId, registry_digest: registryDigest }), authorize });
}

/** Explicit host-local inspection; returns statuses, never provider inputs/results. */
export function inspectTaskRuntime(runId: string, registry: TaskRuntimeRegistry, options: { home?: string } = {}) {
  const registryDigest = taskRuntimeRegistryDigest(registry);
  const store = new RunStore(options.home, { create: false });
  const run = store.readRun(runId);
  const host = runtimeTaskHost(registry, registryDigest, store, runId, run.sandbox, () => false);
  return host.collect(host.runId(registry.plans[0]!));
}

/** Host-installed registry only: programs cannot load provider code or register plans. */
export function createTaskRuntimeAdapters(input: TaskRuntimeRegistry): AdapterRegistry {
  const registry: TaskRuntimeRegistry = { graph: structuredClone(input.graph), policy: structuredClone(input.policy),
    plans: structuredClone(input.plans), receivers: input.receivers.map(r => ({ ...r, input_type: structuredClone(r.input_type), output_type: structuredClone(r.output_type) })) };
  const registryDigest = taskRuntimeRegistryDigest(registry);
  const permits = new AsyncLocalStorage<(r: TaskHostAuthorizationRequest) => boolean>();
  const hosts = new Map<string, TaskHost>();
  const preflight = (operation: string, args: Record<string, unknown>, context: AdapterExecutionContext): void => {
    validateTaskArguments(operation, args);
    requireCondition(args.registry_digest === registryDigest && registry.plans.some(p => p.digest === args.plan_digest), "task_registry_binding_mismatch");
    const request = context.capability_request; const grant = context.capability_grant;
    requireCondition(request && grant && !validateGrant(grant, request).length, "task_runtime_capability_required");
    requireCondition(request.run_id === context.run_id && request.adapter === "mirai_tasks" && request.action === operation && request.resource === taskOperationResource(operation, args) && request.args_digest === digestValue(args) && request.effects.join(",") === TASK_OPERATIONS[operation]!.effect, "task_runtime_scope_mismatch");
    if (requiresTaskApproval(request.effects)) {
      const actor = operation === "accept" ? String(args.reviewer) : registry.policy.owner;
      requireCondition(context.approval && context.approval.approver === actor && verifyApprovalReceipt(context.approval, {
        home: context.store.home, sandbox: context.sandbox, request
      }).valid, "task_runtime_owner_approval_required");
    }
  };
  const hostFor = (context: AdapterExecutionContext): TaskHost => {
    const root = path.join(context.store.directory(context.run_id), "task-hosts", registryDigest.slice(7));
    let host = hosts.get(root);
    if (!host) {
      host = runtimeTaskHost(registry, registryDigest, context.store, context.run_id, context.sandbox, r => permits.getStore()?.(r) === true);
      hosts.set(root, host);
    }
    return host;
  };
  return { mirai_tasks: Object.fromEntries(Object.entries(TASK_OPERATIONS).map(([operation, descriptor]) => [operation, {
    effect: descriptor.effect,
    preflight(args: Record<string, unknown>, context: AdapterExecutionContext) { preflight(operation, args, context); },
    async execute(args: Record<string, unknown>, context: AdapterExecutionContext) {
      preflight(operation, args, context);
      const plan = registry.plans.find(p => p.digest === args.plan_digest);
      requireCondition(plan, "task_plan_not_host_registered");
      const actor = operation === "accept" ? String(args.reviewer) : registry.policy.owner;
      requireCondition(!context.signal?.aborted, "task_runtime_cancelled");
      const taskId = args.task_id as string | undefined;
      const task = taskId ? plan.requests.find(t => t.id === taskId) : undefined;
      if (taskId) requireCondition(task, "task_id_unknown");
      const action = operation === "inference" ? "dispatch" : operation === "submit" ? "create" : operation;
      const permit = (r: TaskHostAuthorizationRequest): boolean => r.action === action && r.plan_digest === plan.digest &&
        r.policy_digest === registry.policy.digest && r.task_id === taskId &&
        r.actor === (action === "dispatch" ? task?.receiver_id : actor) &&
        (action !== "accept" || (r.result_digest === args.result_digest && r.verdict === args.verdict));
      const result = await permits.run(permit, async () => {
        const host = hostFor(context); const runId = host.runId(plan);
        if (operation === "submit") { host.create(plan); return { task_run_id: runId, plan_digest: plan.digest }; }
        if (operation === "dispatch" || operation === "inference") return host.runTask(runId, taskId!, operation === "inference" ? "ai" : "program", context.signal);
        if (operation === "accept") return host.accept(runId, taskId!, actor, args.result_digest as string, args.verdict as "accepted" | "rejected");
        if (operation === "reconcile") return host.reconcileRecordedOutput(runId, taskId!, actor);
        if (operation === "cancel") { host.cancel(runId, actor); return { cancelled: true, plan_digest: plan.digest }; }
        return host.collect(runId);
      });
      requireCondition(!context.signal?.aborted, "task_runtime_cancelled");
      const output = seal({ registry_digest: registryDigest, plan_digest: plan.digest, operation, value: result, canonical_write_allowed: false });
      requireCondition(Buffer.byteLength(JSON.stringify(output)) <= context.max_bytes, "task_runtime_output_budget_exceeded");
      // Commit an adapter outcome under the parent's existing lease before returning.
      const name = "task-bridge-outcomes";
      const previous = context.store.readExtensionState<Record<string, unknown>>(context.run_id, name);
      context.store.updateExtensionState<Record<string, unknown>>(context.run_id, name, previous?.digest ?? null, value => ({ ...value,
        [context.idempotency_key]: { operation, args_digest: digestValue(args), result_digest: digestValue(output), registry_digest: registryDigest } }));
      return output;
    },
    async verify(receipt, context) {
      const state = context.store.readExtensionState<Record<string, { operation: string; args_digest: string; result_digest: string; registry_digest: string }>>(context.run_id, "task-bridge-outcomes");
      const recorded = state?.value[receipt.idempotency_key];
      const verified = !!recorded && recorded.registry_digest === registryDigest && recorded.operation === operation &&
        recorded.args_digest === receipt.args_digest && receipt.result !== undefined && recorded.result_digest === receipt.result_digest && digestValue(receipt.result) === receipt.result_digest;
      return { verified, details: [verified ? "task_outcome_receipt_matched" : "task_outcome_receipt_missing_or_changed"] };
    }
  }])) };
}
