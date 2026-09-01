import { digestValue } from "../core/canonical.js";
import {
  getAdapterOperation,
  REFERENCE_ADAPTERS,
  type AdapterExecutionContext,
  type AdapterRegistry,
  type TestCommandDefinition
} from "../adapters/index.js";
import type { EffectExecutionRequest } from "./pure-interpreter.js";
import {
  RECEIPT_CONTRACT_VERSION,
  type ApprovalReceipt,
  type EffectName,
  type EffectReceipt,
  type RuntimeEffectStub as StoredRuntimeEffectStub
} from "./contracts.js";
import {
  buildCapabilityRequest,
  ReferenceCapabilityProvider,
  validateGrant
} from "./capabilities.js";
import type { RunStore } from "./store.js";

export type FaultInjectionStage = "after_prepare" | "after_execute_before_verify";

function resourceFor(request: EffectExecutionRequest): string {
  if (request.adapter === "repository" || request.adapter === "workspace") {
    const value = typeof request.args.path === "string" ? request.args.path : ".";
    return value === "." ? "." : `./${value.replace(/^\.\//, "")}`;
  }
  if (request.adapter === "git") return ".";
  if (request.adapter === "test") return `command:${String(request.args.command_id || "unknown")}`;
  if (request.adapter === "human") return `approval:${request.node_id}`;
  return `${request.adapter}:${request.operation}`;
}

function effectNames(request: EffectExecutionRequest): EffectName[] {
  return request.effects.filter((effect): effect is EffectName => effect !== "pure") as EffectName[];
}

export class EffectExecutionBlocked extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly receiptId?: string,
    public readonly retryable = false
  ) {
    super(`${code}:${message}`);
  }
}

export class EffectCoordinator {
  private readonly invocations: StoredRuntimeEffectStub[] = [];

  constructor(readonly options: {
    run_id: string;
    program_id: string;
    program_digest: string;
    input_digest: string;
    sandbox: string;
    store: RunStore;
    provider: ReferenceCapabilityProvider;
    approval?: ApprovalReceipt;
    adapters?: AdapterRegistry;
    test_commands?: Record<string, TestCommandDefinition>;
    fault_injection?: FaultInjectionStage;
    deadline_at_ms?: number;
  }) {}

  private context(idempotencyKey: string, maxBytes = 1_000_000, signal?: AbortSignal, effectiveDeadlineAtMs?: number): AdapterExecutionContext {
    const deadline = effectiveDeadlineAtMs ?? this.options.deadline_at_ms;
    const remaining = deadline === undefined ? undefined : Math.max(0, deadline - Date.now());
    return {
      run_id: this.options.run_id,
      sandbox: this.options.sandbox,
      idempotency_key: idempotencyKey,
      max_bytes: maxBytes,
      ...(deadline !== undefined ? { deadline_at_ms: deadline, remaining_ms: remaining } : {}),
      ...(signal ? { signal } : {}),
      store: this.options.store,
      approval: this.options.approval,
      test_commands: this.options.test_commands || {}
    };
  }

  private async withinDeadline<T>(phase: string, operation: (signal: AbortSignal, effectiveDeadlineAtMs: number) => Promise<T>, timeoutMs = 30_000): Promise<T> {
    const localDeadline = Date.now() + timeoutMs;
    const effectiveDeadline = this.options.deadline_at_ms === undefined ? localDeadline : Math.min(localDeadline, this.options.deadline_at_ms);
    const remaining = effectiveDeadline - Date.now();
    if (remaining <= 0) throw new Error(`effect_deadline_exceeded:${phase}`);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error(`effect_deadline_exceeded:${phase}`));
        reject(new Error(`effect_deadline_exceeded:${phase}`));
      }, remaining);
    });
    try {
      return await Promise.race([operation(controller.signal, effectiveDeadline), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private idempotencyKey(request: EffectExecutionRequest): string {
    return digestValue({
      run_id: this.options.run_id,
      program_digest: request.program_digest,
      input_digest: this.options.input_digest,
      args_digest: digestValue(request.args),
      program_id: request.program_id,
      node_id: request.node_id,
      adapter: request.adapter,
      operation: request.operation,
      args: request.args,
      invocation_id: request.invocation_id,
      effects: request.effects
    });
  }

  async execute(request: EffectExecutionRequest): Promise<unknown> {
    const idempotencyKey = this.idempotencyKey(request);
    const receiptId = `receipt.${idempotencyKey.slice(7, 23)}`;
    const sequence = this.invocations.length + 1;
    const recordSuccess = (result: unknown, receipt: EffectReceipt): unknown => {
      this.invocations.push({
        sequence,
        receipt_id: receipt.receipt_id,
        node_id: request.node_id,
        invocation_id: request.invocation_id,
        adapter: request.adapter,
        operation: request.operation,
        args_digest: digestValue(request.args),
        status: receipt.status === "compensated" ? "compensated" : "verified",
        result,
        result_digest: digestValue(result)
      });
      return result;
    };
    try {
      if (this.options.deadline_at_ms !== undefined && Date.now() >= this.options.deadline_at_ms) {
        throw new EffectExecutionBlocked("effect_deadline_exceeded", "Activation deadline elapsed before effect start");
      }
      const effects = effectNames(request);
      const operation = getAdapterOperation(this.options.adapters || REFERENCE_ADAPTERS, request.adapter, request.operation);
      if (effects.length !== 1 || effects[0] !== operation.effect) throw new EffectExecutionBlocked("adapter_effect_mismatch", `${request.adapter}.${request.operation} does not match declared effects`);
      const existing = this.options.store.readReceipt(this.options.run_id, receiptId);
    if (existing) {
      if (existing.status === "verified") return recordSuccess(existing.result, existing);
      if (existing.status === "compensated") throw new EffectExecutionBlocked("effect_already_compensated", `Effect ${receiptId} was compensated`, receiptId);
      if (existing.status === "executed" || (existing.status === "uncertain" && existing.result !== undefined)) {
        const verification = await this.withinDeadline("reconcile", (signal, deadline) => operation.verify(existing, this.context(idempotencyKey, 1_000_000, signal, deadline)));
        const reconciled: EffectReceipt = verification.verified ? {
          ...existing,
          status: "verified",
          verified_at: new Date().toISOString(),
          reconciled_at: new Date().toISOString(),
          verification: { status: "verified", details: verification.details }
        } : {
          ...existing,
          status: "uncertain",
          reconciled_at: new Date().toISOString(),
          verification: { status: "not_verified", details: verification.details }
        };
        this.options.store.writeReceipt(this.options.run_id, reconciled);
        if (reconciled.status === "verified") return recordSuccess(reconciled.result, reconciled);
      }
      if (existing.status === "failed" && existing.failure?.retry_safe) {
        // A failure before adapter invocation may retry under the same key.
      } else {
        throw new EffectExecutionBlocked("effect_reconciliation_required", `Effect ${receiptId} is ${existing.status}`, receiptId);
      }
    }

    const resource = resourceFor(request);
    const capabilityRequest = buildCapabilityRequest({
      run_id: this.options.run_id,
      program_digest: request.program_digest,
      input_digest: this.options.input_digest,
      args_digest: digestValue(request.args),
      node_id: request.node_id,
      adapter: request.adapter,
      action: request.operation,
      resource,
      effects,
      capability: request.capability,
      budget: { max_calls: 1, max_bytes: 1_000_000, timeout_ms: 30_000 },
      policy_digest: this.options.provider.digest,
      approval_required: operation.effect === "workspace_patch" || operation.effect === "process_run" || operation.effect === "human_approval"
    });
    const capability = this.options.provider.request(capabilityRequest);
    this.options.store.writeCapabilityRequest(this.options.run_id, capabilityRequest);
    this.options.store.writePolicyDecision(this.options.run_id, capability.decision);
    if (!capability.grant) throw new EffectExecutionBlocked(`capability_${capability.decision.decision}`, capability.decision.reasons.join(", "));
    const grant = capability.grant;
    const grantErrors = validateGrant(grant, capabilityRequest);
    if (grantErrors.length) throw new EffectExecutionBlocked("capability_grant_invalid", grantErrors.join(", "));
    const grantRef = this.options.store.writeCapability(this.options.run_id, grant);
    const now = new Date().toISOString();
    const prepared: EffectReceipt = {
      contract_version: RECEIPT_CONTRACT_VERSION,
      receipt_id: receiptId,
      idempotency_key: idempotencyKey,
      run_id: this.options.run_id,
      program_id: request.program_id,
      program_digest: request.program_digest,
      node_id: request.node_id,
      adapter: request.adapter,
      operation: request.operation,
      effects,
      capability_grant_ref: grantRef,
      args_digest: digestValue(request.args),
      invocation_id: request.invocation_id,
      status: "prepared",
      sequence: existing?.sequence || this.options.store.listReceipts(this.options.run_id).reduce((maximum, item) => Math.max(maximum, item.sequence || 0), 0) + 1,
      attempt: (existing?.attempt || 0) + 1,
      prepared_at: now,
      compensation: { status: operation.compensate ? "available" : "not_available" }
    };
    this.options.store.writeReceipt(this.options.run_id, prepared);
    this.options.store.appendEvent(this.options.run_id, { type: "effect_prepared", receipt_id: receiptId, node_id: request.node_id });
    if (this.options.fault_injection === "after_prepare") {
      const failed: EffectReceipt = {
        ...prepared,
        status: "failed",
        failed_at: new Date().toISOString(),
        failure: { code: "fault_injected_after_prepare", message: "Fault injected before adapter invocation", retry_safe: true }
      };
      this.options.store.writeReceipt(this.options.run_id, failed);
      throw new EffectExecutionBlocked("fault_injected_after_prepare", "Fault injected before adapter invocation", receiptId, true);
    }
    let result: unknown;
    try {
      result = await this.withinDeadline("execute", (signal, deadline) => operation.execute(request.args, this.context(idempotencyKey, grant.budget.max_bytes, signal, deadline)), grant.budget.timeout_ms);
    } catch (error) {
      const retrySafe = operation.effect === "repository_read" || operation.effect === "git_read";
      const failed: EffectReceipt = {
        ...prepared,
        status: retrySafe ? "failed" : "uncertain",
        failed_at: new Date().toISOString(),
        failure: { code: "adapter_execution_failed", message: error instanceof Error ? error.message : String(error), retry_safe: retrySafe }
      };
      this.options.store.writeReceipt(this.options.run_id, failed);
      throw new EffectExecutionBlocked(retrySafe ? "adapter_execution_failed" : "effect_uncertain", failed.failure?.message || "adapter failed", receiptId, retrySafe);
    }
    const executed: EffectReceipt = {
      ...prepared,
      status: "executed",
      executed_at: new Date().toISOString(),
      result,
      result_digest: digestValue(result),
      compensation: operation.compensate && result && typeof result === "object" && "backup_ref" in result
        ? { status: "available", backup_ref: String((result as Record<string, unknown>).backup_ref) }
        : prepared.compensation
    };
    this.options.store.writeReceipt(this.options.run_id, executed);
    this.options.store.appendEvent(this.options.run_id, { type: "effect_executed", receipt_id: receiptId, result_digest: executed.result_digest });
    if (this.options.fault_injection === "after_execute_before_verify") throw new EffectExecutionBlocked("fault_injected_after_execute", "Fault injected after adapter result was durably recorded", receiptId);
    const verification = await this.withinDeadline("verify", (signal, deadline) => operation.verify(executed, this.context(idempotencyKey, grant.budget.max_bytes, signal, deadline)), grant.budget.timeout_ms);
    if (!verification.verified) {
      const uncertain: EffectReceipt = {
        ...executed,
        status: "uncertain",
        verification: { status: "not_verified", details: verification.details }
      };
      this.options.store.writeReceipt(this.options.run_id, uncertain);
      throw new EffectExecutionBlocked("effect_verification_failed", verification.details.join(", "), receiptId);
    }
    const verified: EffectReceipt = {
      ...executed,
      status: "verified",
      verified_at: new Date().toISOString(),
      verification: { status: "verified", details: verification.details }
    };
    this.options.store.writeReceipt(this.options.run_id, verified);
    this.options.store.appendEvent(this.options.run_id, { type: "effect_verified", receipt_id: receiptId });
      return recordSuccess(result, verified);
    } catch (error) {
      const blocked = error instanceof EffectExecutionBlocked
        ? error
        : new EffectExecutionBlocked("effect_execution_failed", error instanceof Error ? error.message : String(error), receiptId);
      this.invocations.push({
        sequence,
        receipt_id: blocked.receiptId,
        node_id: request.node_id,
        invocation_id: request.invocation_id,
        adapter: request.adapter,
        operation: request.operation,
        args_digest: digestValue(request.args),
        status: "failed",
        error_code: blocked.code,
        error_message: blocked.message
      });
      throw blocked;
    }
  }

  async compensate(receiptId: string): Promise<void> {
    const receipt = this.options.store.readReceipt(this.options.run_id, receiptId)
      || this.options.store.listReceipts(this.options.run_id).find((item) => item.node_id === receiptId);
    if (!receipt) throw new EffectExecutionBlocked("receipt_not_found", receiptId);
    if (receipt.status === "compensated") return;
    if (receipt.status !== "verified") throw new EffectExecutionBlocked("compensation_requires_verified_receipt", receipt.status, receiptId);
    const operation = getAdapterOperation(this.options.adapters || REFERENCE_ADAPTERS, receipt.adapter, receipt.operation);
    if (!operation.compensate) throw new EffectExecutionBlocked("compensation_not_supported", `${receipt.adapter}.${receipt.operation}`, receiptId);
    let result: Awaited<ReturnType<NonNullable<typeof operation.compensate>>>;
    try {
      result = await this.withinDeadline("compensate", (signal, deadline) => operation.compensate!(receipt, this.context(receipt.idempotency_key, 1_000_000, signal, deadline)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const uncertain: EffectReceipt = {
        ...receipt,
        status: "uncertain",
        reconciled_at: new Date().toISOString(),
        failure: { code: "compensation_uncertain", message, retry_safe: false }
      };
      this.options.store.writeReceipt(this.options.run_id, uncertain);
      throw new EffectExecutionBlocked("compensation_uncertain", message, receiptId);
    }
    if (!result.compensated) throw new EffectExecutionBlocked("compensation_failed", result.details.join(", "), receiptId);
    this.options.store.writeReceipt(this.options.run_id, {
      ...receipt,
      status: "compensated",
      compensated_at: new Date().toISOString(),
      compensation: { ...receipt.compensation, status: "completed" }
    });
    this.options.store.appendEvent(this.options.run_id, { type: "effect_compensated", receipt_id: receiptId });
  }

  async reconcile(): Promise<string[]> {
    const blockers: string[] = [];
    for (const receipt of this.options.store.listReceipts(this.options.run_id)) {
      if (receipt.status === "verified" || receipt.status === "compensated" || receipt.status === "failed") continue;
      if (receipt.failure?.code === "compensation_uncertain") {
        blockers.push(`compensation_reconciliation_required:${receipt.receipt_id}`);
        continue;
      }
      if (receipt.result !== undefined) {
        const operation = getAdapterOperation(this.options.adapters || REFERENCE_ADAPTERS, receipt.adapter, receipt.operation);
        const verification = await this.withinDeadline("reconcile", (signal, deadline) => operation.verify(receipt, this.context(receipt.idempotency_key, 1_000_000, signal, deadline)));
        const next: EffectReceipt = verification.verified ? {
          ...receipt,
          status: "verified",
          verified_at: new Date().toISOString(),
          reconciled_at: new Date().toISOString(),
          verification: { status: "verified", details: verification.details }
        } : {
          ...receipt,
          status: "uncertain",
          reconciled_at: new Date().toISOString(),
          verification: { status: "not_verified", details: verification.details }
        };
        this.options.store.writeReceipt(this.options.run_id, next);
        if (next.status !== "verified") blockers.push(`receipt_uncertain:${receipt.receipt_id}`);
      } else blockers.push(`receipt_uncertain:${receipt.receipt_id}`);
    }
    return blockers.sort();
  }

  effectStubs(): StoredRuntimeEffectStub[] {
    return structuredClone(this.invocations);
  }
}
