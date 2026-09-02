import path from "node:path";
import { digestValue } from "../core/canonical.js";
import type { AdapterRegistry, TestCommandDefinition } from "../adapters/index.js";
import type { MiraiProgram } from "../program/types.js";
import { validateProgram } from "../program/validator.js";
import {
  EPISODE_CONTRACT_VERSION,
  type ApprovalReceipt,
  type GovernedEpisode,
  type RuntimeRunRecord
} from "./contracts.js";
import {
  DEFAULT_CAPABILITY_POLICY,
  ReferenceCapabilityProvider,
  type CapabilityAuthorization,
  type CapabilityPolicy
} from "./capabilities.js";
import { EffectCoordinator, EffectExecutionBlocked, type FaultInjectionStage } from "./effects.js";
import { executeWithEffects } from "./pure-interpreter.js";
import { RunStore } from "./store.js";

interface PersistedRuntimeConfig {
  policy: CapabilityPolicy;
  programs: Record<string, MiraiProgram>;
  events: Record<string, unknown>;
  test_commands: Record<string, TestCommandDefinition>;
  authorization?: CapabilityAuthorization;
}

export interface GovernedRunOptions {
  store?: RunStore;
  home?: string;
  sandbox: string;
  apply?: boolean;
  approval?: ApprovalReceipt;
  policy?: CapabilityPolicy;
  authorization?: CapabilityAuthorization;
  programs?: Record<string, MiraiProgram>;
  events?: Record<string, unknown>;
  test_commands?: Record<string, TestCommandDefinition>;
  adapters?: AdapterRegistry;
  run_id?: string;
  fault_injection?: FaultInjectionStage;
  deadline_at_ms?: number;
}

export interface GovernedRunResult {
  run: RuntimeRunRecord;
  episode?: GovernedEpisode;
  checkpoint: ReturnType<RunStore["readCheckpoint"]>;
}

function assertProgram(program: MiraiProgram): void {
  const validation = validateProgram(program);
  if (!validation.valid) throw new Error(`runtime_program_invalid:${validation.errors.join(",")}`);
}

function updateStatus(store: RunStore, runId: string, status: RuntimeRunRecord["status"], additions: Partial<RuntimeRunRecord> = {}): RuntimeRunRecord {
  const current = store.readRun(runId);
  return store.updateRun(runId, current.revision, (record) => ({ ...record, ...additions, status }));
}

function coordinatorFor(options: {
  store: RunStore;
  run: RuntimeRunRecord;
  config: PersistedRuntimeConfig;
  approval?: ApprovalReceipt;
  adapters?: AdapterRegistry;
  fault_injection?: FaultInjectionStage;
  deadline_at_ms?: number;
}): EffectCoordinator {
  const provider = new ReferenceCapabilityProvider(options.config.policy, {
    home: options.store.home,
    sandbox: options.run.sandbox,
    apply: options.run.apply_requested,
    approval: options.approval,
    approval_ref: options.approval ? "approval.json" : undefined,
    authorization: options.config.authorization
  });
  return new EffectCoordinator({
    run_id: options.run.run_id,
    program_id: options.run.program_id,
    program_digest: options.run.program_digest,
    input_digest: options.run.input_digest,
    sandbox: options.run.sandbox,
    store: options.store,
    provider,
    approval: options.approval,
    adapters: options.adapters,
    test_commands: options.config.test_commands,
    fault_injection: options.fault_injection,
    deadline_at_ms: options.deadline_at_ms
  });
}

async function executeExisting(options: {
  store: RunStore;
  run_id: string;
  adapters?: AdapterRegistry;
  fault_injection?: FaultInjectionStage;
  deadline_at_ms?: number;
}): Promise<GovernedRunResult> {
  const lease = options.store.acquireLease(options.run_id);
  try {
    let run = options.store.readRun(options.run_id);
    if (run.status === "completed") return { run, episode: options.store.readEpisode(run.run_id), checkpoint: options.store.readCheckpoint(run.run_id) };
    if (run.status === "cancelled") return { run, checkpoint: options.store.readCheckpoint(run.run_id) };
    try {
      const checkpoint = options.store.readCheckpoint(run.run_id);
      if (checkpoint.contract_version !== "1.0.0" || checkpoint.run_id !== run.run_id || checkpoint.revision > run.revision || checkpoint.event_sequence > run.event_sequence) {
        throw new Error("checkpoint_fields_invalid");
      }
    } catch (error) {
      throw new EffectExecutionBlocked("runtime_checkpoint_invalid", error instanceof Error ? error.message : String(error));
    }
    const program = options.store.readProgram(run.run_id);
    const input = options.store.readInput(run.run_id);
    const config = options.store.readRuntimeConfig(run.run_id) as unknown as PersistedRuntimeConfig;
    const approval = options.store.readApproval(run.run_id);
    assertProgram(program);
    if (program.digest !== run.program_digest || digestValue(input) !== run.input_digest) throw new Error("runtime_artifact_digest_mismatch");
    const coordinator = coordinatorFor({ store: options.store, run, config, approval, adapters: options.adapters, fault_injection: options.fault_injection, deadline_at_ms: options.deadline_at_ms });
    const reconciliationBlockers = await coordinator.reconcile();
    if (reconciliationBlockers.length) {
      run = updateStatus(options.store, run.run_id, "blocked", { blockers: reconciliationBlockers });
      options.store.appendEvent(run.run_id, { type: "run_blocked", blockers: reconciliationBlockers });
      options.store.writeCheckpoint(run.run_id);
      throw new EffectExecutionBlocked("run_reconciliation_blocked", reconciliationBlockers.join(", "));
    }
    const isResume = run.started_at !== undefined;
    run = updateStatus(options.store, run.run_id, "running", { started_at: run.started_at || new Date().toISOString(), blockers: [] });
    options.store.appendEvent(run.run_id, { type: "run_started", resume: isResume });
    const execution = await executeWithEffects(
      program,
      input,
      (request) => coordinator.execute(request),
      { programs: config.programs || {}, events: config.events || {} },
      (receipt) => coordinator.compensate(String(receipt))
    );
    const unsettled = options.store.listReceipts(run.run_id).filter((receipt) => !["verified", "compensated", "failed"].includes(receipt.status));
    if (unsettled.length) throw new EffectExecutionBlocked("unsettled_effect_receipts", unsettled.map((item) => item.receipt_id).join(", "));
    const effectStubs = coordinator.effectStubs();
    const episode: GovernedEpisode = {
      contract_version: EPISODE_CONTRACT_VERSION,
      episode_id: `episode.${digestValue({
        run: run.run_id,
        trace: execution.trace_digest,
        effects: effectStubs.map((item) => ({ status: item.status, result_digest: item.result_digest, error_code: item.error_code }))
      }).slice(7, 23)}`,
      run_id: run.run_id,
      program_id: execution.program_id,
      program_digest: execution.program_digest,
      input_digest: execution.input_digest,
      replay_input: execution.replay_input,
      status: execution.status,
      outputs: execution.outputs,
      output_digest: execution.output_digest,
      final_state: execution.final_state,
      emitted_events: execution.emitted_events,
      trace: execution.trace,
      trace_digest: execution.trace_digest,
      steps: execution.steps,
      logical_duration_ms: execution.logical_duration_ms,
      effects_executed: execution.effects_executed,
      effect_stubs: effectStubs,
      receipt_refs: options.store.listReceipts(run.run_id).map((receipt) => `host-local://receipts/${receipt.receipt_id}`),
      policy_decision_refs: options.store.listPolicyDecisionRefs(run.run_id).map((ref) => `host-local://${ref}`),
      checkpoint_ref: "host-local://checkpoint.json",
      canonical_write_allowed: false,
      learning_update_allowed: false,
      limitations: [
        "Episode evidence does not authorize canonical graph updates.",
        "External effect results are host-local and are removed from sanitized exports."
      ]
    };
    options.store.writeEpisode(run.run_id, episode);
    run = updateStatus(options.store, run.run_id, execution.status === "cancelled" ? "cancelled" : "completed", {
      finished_at: new Date().toISOString(),
      episode_ref: "episode.json",
      blockers: []
    });
    options.store.appendEvent(run.run_id, { type: "run_finished", status: run.status, episode_id: episode.episode_id });
    const checkpoint = options.store.writeCheckpoint(run.run_id);
    return { run: options.store.readRun(run.run_id), episode, checkpoint };
  } catch (error) {
    const current = options.store.readRun(options.run_id);
    if (!current.finished_at && current.status !== "cancelled" && current.status !== "blocked") {
      const unsettled = options.store.listReceipts(current.run_id).filter((receipt) => ["prepared", "executed", "uncertain"].includes(receipt.status));
      const blocker = error instanceof EffectExecutionBlocked ? error.code : error instanceof Error ? error.message : String(error);
      updateStatus(options.store, current.run_id, unsettled.length || blocker === "runtime_checkpoint_invalid" ? "blocked" : "failed", {
        blockers: [blocker, ...unsettled.map((item) => `receipt_unsettled:${item.receipt_id}`)]
      });
      options.store.appendEvent(current.run_id, { type: "run_failed", blocker });
      if (blocker !== "runtime_checkpoint_invalid") options.store.writeCheckpoint(current.run_id);
    }
    throw error;
  } finally {
    options.store.releaseLease(options.run_id, lease.token);
  }
}

export async function startGovernedRun(program: MiraiProgram, input: Record<string, unknown>, options: GovernedRunOptions): Promise<GovernedRunResult> {
  assertProgram(program);
  const store = options.store || new RunStore(options.home);
  const config: PersistedRuntimeConfig = {
    policy: options.policy || DEFAULT_CAPABILITY_POLICY,
    programs: options.programs || {},
    events: options.events || {},
    test_commands: options.test_commands || {},
    ...(options.authorization ? { authorization: options.authorization } : {})
  };
  const run = store.createRun({
    program,
    input,
    sandbox: path.resolve(options.sandbox),
    apply: options.apply === true,
    approval_receipt_ref: options.approval ? "approval.json" : undefined,
    run_id: options.run_id || options.approval?.run_id,
    runtime_config: config as unknown as Record<string, unknown>
  });
  if (options.approval) store.writeApproval(run.run_id, options.approval);
  store.appendEvent(run.run_id, { type: "run_prepared", program_digest: program.digest });
  store.writeCheckpoint(run.run_id);
  return executeExisting({ store, run_id: run.run_id, adapters: options.adapters, fault_injection: options.fault_injection, deadline_at_ms: options.deadline_at_ms });
}

export async function resumeGovernedRun(runId: string, options: { store?: RunStore; home?: string; adapters?: AdapterRegistry; approval?: ApprovalReceipt } = {}): Promise<GovernedRunResult> {
  const store = options.store || new RunStore(options.home);
  if (options.approval) {
    if (options.approval.run_id !== runId) throw new Error("approval_run_id_mismatch");
    store.writeApproval(runId, options.approval);
    const current = store.readRun(runId);
    store.updateRun(runId, current.revision, (record) => ({ ...record, approval_receipt_ref: "approval.json" }));
  }
  return executeExisting({ store, run_id: runId, adapters: options.adapters });
}

export function inspectGovernedRun(runId: string, options: { store?: RunStore; home?: string } = {}): Record<string, unknown> {
  const store = options.store || new RunStore(options.home);
  const run = store.readRun(runId);
  return {
    run: { ...run, sandbox: "redacted-host-local", approval_receipt_ref: run.approval_receipt_ref ? "host-local://approval.json" : undefined },
    checkpoint: store.readCheckpoint(runId),
    receipts: store.listReceipts(runId).map(({ result: _result, capability_grant_ref: _grant, ...receipt }) => receipt),
    episode_available: run.episode_ref === "episode.json"
  };
}

export function cancelGovernedRun(runId: string, options: { store?: RunStore; home?: string } = {}): GovernedRunResult {
  const store = options.store || new RunStore(options.home);
  const lease = store.acquireLease(runId);
  try {
    const current = store.readRun(runId);
    if (current.status === "completed") throw new Error("completed_run_cannot_be_cancelled");
    const run = updateStatus(store, runId, "cancelled", { finished_at: new Date().toISOString(), blockers: [] });
    store.appendEvent(runId, { type: "run_cancelled" });
    return { run: store.readRun(runId), checkpoint: store.writeCheckpoint(runId) };
  } finally {
    store.releaseLease(runId, lease.token);
  }
}

export async function reconcileGovernedRun(runId: string, options: { store?: RunStore; home?: string; adapters?: AdapterRegistry } = {}): Promise<GovernedRunResult> {
  const store = options.store || new RunStore(options.home);
  const lease = store.acquireLease(runId);
  try {
    const run = store.readRun(runId);
    const config = store.readRuntimeConfig(runId) as unknown as PersistedRuntimeConfig;
    const coordinator = coordinatorFor({ store, run, config, approval: store.readApproval(runId), adapters: options.adapters });
    const blockers = await coordinator.reconcile();
    const next = updateStatus(store, runId, blockers.length ? "blocked" : "prepared", { blockers });
    store.appendEvent(runId, { type: "run_reconciled", blockers });
    return { run: store.readRun(runId), checkpoint: store.writeCheckpoint(runId) };
  } finally {
    store.releaseLease(runId, lease.token);
  }
}

export async function replayGovernedEpisode(
  episode: GovernedEpisode,
  program: MiraiProgram,
  options: { programs?: Record<string, MiraiProgram>; events?: Record<string, unknown> } = {}
): Promise<{ status: "match" | "mismatch"; output_digest: string; trace_digest: string; effects_executed: false; errors: string[] }> {
  assertProgram(program);
  if (program.digest !== episode.program_digest) return { status: "mismatch", output_digest: "", trace_digest: "", effects_executed: false, errors: ["program_digest_mismatch"] };
  let index = 0;
  const replay = await executeWithEffects(program, episode.replay_input, async (request) => {
    const stub = episode.effect_stubs[index++];
    if (!stub) throw new Error("effect_stub_missing");
    const argsDigest = digestValue(request.args);
    if (stub.node_id !== request.node_id || stub.invocation_id !== request.invocation_id || stub.adapter !== request.adapter || stub.operation !== request.operation || stub.args_digest !== argsDigest) {
      throw new Error("effect_stub_mismatch");
    }
    if (stub.status === "failed") throw new Error(stub.error_message || stub.error_code || "replayed_effect_failure");
    if (!("result" in stub)) throw new Error("effect_stub_result_missing");
    return structuredClone(stub.result);
  }, { programs: options.programs || {}, events: options.events || {} }, async () => undefined);
  const errors: string[] = [];
  if (index !== episode.effect_stubs.length) errors.push("unused_effect_stubs");
  if (replay.output_digest !== episode.output_digest) errors.push("output_digest_mismatch");
  if (replay.trace_digest !== episode.trace_digest) errors.push("trace_digest_mismatch");
  return {
    status: errors.length ? "mismatch" : "match",
    output_digest: replay.output_digest,
    trace_digest: replay.trace_digest,
    effects_executed: false,
    errors
  };
}
