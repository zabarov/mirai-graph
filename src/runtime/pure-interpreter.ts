import { canonicalJson, digestValue } from "../core/canonical.js";
import type { MiraiProgram, ProgramNode, SlotDefinition } from "../program/types.js";
import { validateProgram, valueMatchesType } from "../program/validator.js";
import { evaluateExpression, evaluateMap, type EvaluationScope } from "./expression.js";
import { DEFAULT_PURE_ADAPTERS, type PureAdapterRegistry } from "./pure-adapters.js";

export const PURE_EPISODE_CONTRACT_VERSION = "1.0.0" as const;

export interface PureTraceEvent {
  sequence: number;
  logical_time: number;
  depth: number;
  program_id: string;
  node_id: string;
  kind: string;
  decision: string;
  result_digest?: string;
}

export interface PureEpisode {
  contract_version: typeof PURE_EPISODE_CONTRACT_VERSION;
  episode_id: string;
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
  effects_executed: false;
  canonical_write_allowed: false;
  limitations: string[];
}

export interface ExecutionEpisode extends Omit<PureEpisode, "effects_executed"> {
  effects_executed: boolean;
}

export interface EffectExecutionRequest {
  program_id: string;
  program_digest: string;
  node_id: string;
  invocation_id: string;
  adapter: string;
  operation: string;
  args: Record<string, unknown>;
  effects: string[];
  capability: string;
}

export type EffectExecutor = (request: EffectExecutionRequest) => Promise<unknown>;
export type CompensationExecutor = (receipt: unknown, context: { program_id: string; node_id: string }) => Promise<void>;

export interface PureExecutionOptions {
  programs?: Record<string, MiraiProgram>;
  adapters?: PureAdapterRegistry;
  events?: Record<string, unknown>;
}

export class PureExecutionError extends Error {
  constructor(public readonly code: string, message: string, public readonly nodeId?: string) {
    super(message);
  }
}

interface ExecutionState {
  trace: PureTraceEvent[];
  emitted: Array<{ event: string; payload: unknown }>;
  steps: number;
  iterations: number;
  logicalTime: number;
  root: MiraiProgram;
  registry: Record<string, MiraiProgram>;
  adapters: PureAdapterRegistry;
  events: Record<string, unknown>;
  effectExecutor?: EffectExecutor;
  compensationExecutor?: CompensationExecutor;
  externalEffectCount: number;
}

interface InternalResult {
  status: "completed" | "cancelled";
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function initializeSlots(slots: SlotDefinition[], values: Record<string, unknown>, label: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const slot of slots) {
    const present = Object.prototype.hasOwnProperty.call(values, slot.id);
    const value = present ? values[slot.id] : slot.default;
    if (value === undefined && slot.required !== false) throw new PureExecutionError(`${label}_required`, `Missing ${label} ${slot.id}`);
    if (value !== undefined && !valueMatchesType(value, slot.type)) throw new PureExecutionError(`${label}_type_mismatch`, `Invalid ${label} ${slot.id}`);
    if (value !== undefined) result[slot.id] = clone(value);
  }
  for (const key of Object.keys(values)) if (!slots.some((slot) => slot.id === key)) throw new PureExecutionError(`unknown_${label}`, `Unknown ${label} ${key}`);
  return result;
}

function record(state: ExecutionState, program: MiraiProgram, node: ProgramNode, depth: number, decision: string, result?: unknown): void {
  state.logicalTime += 1;
  if (state.logicalTime > state.root.policies.budgets.max_duration_ms) {
    throw new PureExecutionError("duration_budget_exceeded", "Program exceeded max_duration_ms", node.id);
  }
  state.trace.push({
    sequence: state.trace.length + 1,
    logical_time: state.logicalTime,
    depth,
    program_id: program.id,
    node_id: node.id,
    kind: node.kind,
    decision,
    ...(result === undefined ? {} : { result_digest: digestValue(result) })
  });
}

function step(state: ExecutionState, program: MiraiProgram, node: ProgramNode, depth: number): void {
  state.steps += 1;
  if (state.steps > state.root.policies.budgets.max_steps) throw new PureExecutionError("step_budget_exceeded", "Program exceeded max_steps", node.id);
  if (depth > state.root.policies.budgets.max_depth || depth > program.policies.budgets.max_depth) throw new PureExecutionError("depth_budget_exceeded", "Program exceeded max_depth", node.id);
}

function resolveProgram(state: ExecutionState, parent: MiraiProgram, reference: string): MiraiProgram {
  const imported = parent.imports.find((item) => item.alias === reference || item.ref === reference);
  const child = state.registry[reference] || (imported && (state.registry[imported.ref] || state.registry[imported.alias]));
  if (!child) throw new PureExecutionError("program_not_found", `Program not found: ${reference}`);
  if (imported && imported.digest !== child.digest) throw new PureExecutionError("import_digest_mismatch", `Import digest mismatch: ${reference}`);
  return child;
}

function routeError(program: MiraiProgram, node: ProgramNode, error: unknown): string | undefined {
  if (node.kind === "call" && node.on_error) return node.on_error;
  if (node.kind === "compensate" && node.on_error) return node.on_error;
  const code = error instanceof PureExecutionError ? error.code : error instanceof Error ? error.message : String(error);
  return program.error_routes.find((route) => route.error === code || route.error === "*")?.to;
}

async function executeProgram(
  program: MiraiProgram,
  rawInput: Record<string, unknown>,
  state: ExecutionState,
  depth: number,
  invocationPath: string
): Promise<InternalResult> {
  const validation = validateProgram(program);
  if (!validation.valid) throw new PureExecutionError("program_invalid", validation.errors.join(", "));
  if (!state.effectExecutor && program.policies.allowed_effects.some((effect) => effect !== "pure")) throw new PureExecutionError("non_pure_effect_forbidden", "Pure interpreter accepts only pure effects");
  const input = initializeSlots(program.inputs, rawInput, "input");
  const localState = initializeSlots(program.state, {}, "state");
  const scope: EvaluationScope = { input, state: localState, local: {} };
  const byId = new Map(program.nodes.map((node) => [node.id, node]));
  let current: string | undefined = program.entry;

  while (current) {
    const node = byId.get(current);
    if (!node) throw new PureExecutionError("node_not_found", `Node not found: ${current}`, current);
    step(state, program, node, depth);
    try {
      if (node.kind === "call") {
        const args = evaluateMap(node.args, scope);
        let result: unknown;
        if (node.target.kind === "program") {
          result = (await executeProgram(
            resolveProgram(state, program, node.target.program),
            args,
            state,
            depth + 1,
            `${invocationPath}/call:${node.id}`
          )).outputs;
        } else {
          const effects = node.effects || ["pure"];
          if (effects.some((effect) => effect !== "pure")) {
            if (!state.effectExecutor || !node.capability) throw new PureExecutionError("non_pure_effect_forbidden", "Adapter call is not authorized for governed execution", node.id);
            state.externalEffectCount += 1;
            result = await state.effectExecutor({
              program_id: program.id,
              program_digest: program.digest,
              node_id: node.id,
              invocation_id: `${invocationPath}/node:${node.id}`,
              adapter: node.target.adapter,
              operation: node.target.operation,
              args,
              effects,
              capability: node.capability
            });
          } else {
            const operation = state.adapters[node.target.adapter]?.[node.target.operation];
            if (!operation) throw new PureExecutionError("adapter_operation_not_found", `${node.target.adapter}.${node.target.operation}`, node.id);
            result = await operation(args, { program_id: program.id, node_id: node.id, attempt: 1 });
          }
        }
        if (node.result) localState[node.result] = clone(result);
        record(state, program, node, depth, "completed", result);
        current = node.next;
      } else if (node.kind === "branch") {
        const selected = Boolean(evaluateExpression(node.condition, scope)) ? node.then : node.else;
        record(state, program, node, depth, `selected:${selected}`);
        current = selected;
      } else if (node.kind === "match") {
        const value = evaluateExpression(node.value, scope);
        const selected = node.cases.find((item) => canonicalJson(item.equals) === canonicalJson(value))?.to || node.default;
        record(state, program, node, depth, `selected:${selected}`);
        current = selected;
      } else if (node.kind === "foreach") {
        const items = evaluateExpression(node.items, scope);
        if (!Array.isArray(items)) throw new PureExecutionError("foreach_items_not_list", "foreach items must be a list", node.id);
        if (items.length > node.max_iterations) throw new PureExecutionError("foreach_node_budget_exceeded", "foreach max_iterations exceeded", node.id);
        state.iterations += items.length;
        if (state.iterations > state.root.policies.budgets.max_iterations) throw new PureExecutionError("iteration_budget_exceeded", "Program exceeded max_iterations", node.id);
        const child = resolveProgram(state, program, node.program);
        const results: unknown[] = [];
        for (const [index, item] of items.entries()) {
          const childInput = { ...evaluateMap(node.input, scope), [node.item]: clone(item) };
          results.push((await executeProgram(
            child,
            childInput,
            state,
            depth + 1,
            `${invocationPath}/foreach:${node.id}:${index}`
          )).outputs);
        }
        if (node.result) localState[node.result] = results;
        record(state, program, node, depth, `iterations:${items.length}`, results);
        current = node.next;
      } else if (node.kind === "parallel") {
        if (node.branches.length > node.max_parallel || node.branches.length > state.root.policies.budgets.max_parallel) throw new PureExecutionError("parallel_budget_exceeded", "Parallel width exceeded", node.id);
        const branchResults: Array<{ id: string; value: Record<string, unknown> }> = [];
        for (const branch of node.branches) {
          const child = resolveProgram(state, program, branch.program);
          const value = (await executeProgram(
            child,
            evaluateMap(branch.input, scope),
            state,
            depth + 1,
            `${invocationPath}/parallel:${node.id}:${branch.id}`
          )).outputs;
          branchResults.push({ id: branch.id, value });
        }
        let merged: unknown;
        if (node.merge === "array") merged = branchResults.map((item) => item.value);
        else if (node.merge === "object") merged = Object.fromEntries(branchResults.map((item) => [item.id, item.value]));
        else merged = branchResults.every((item) => item.value !== undefined);
        if (node.result) localState[node.result] = merged;
        record(state, program, node, depth, `joined:${node.merge}`, merged);
        current = node.next;
      } else if (node.kind === "await") {
        if (Object.prototype.hasOwnProperty.call(state.events, node.event)) {
          const value = clone(state.events[node.event]);
          if (node.result) localState[node.result] = value;
          record(state, program, node, depth, "event_received", value);
          current = node.next;
        } else {
          record(state, program, node, depth, "deadline_elapsed");
          current = node.on_timeout;
        }
      } else if (node.kind === "retry") {
        const child = resolveProgram(state, program, node.program);
        let result: InternalResult | undefined;
        let lastError: unknown;
        for (let attempt = 1; attempt <= node.max_attempts; attempt += 1) {
          state.iterations += 1;
          if (state.iterations > state.root.policies.budgets.max_iterations) throw new PureExecutionError("iteration_budget_exceeded", "Program exceeded max_iterations", node.id);
          try {
            const startedAt = state.logicalTime;
            result = await executeProgram(
              child,
              evaluateMap(node.input, scope),
              state,
              depth + 1,
              `${invocationPath}/retry:${node.id}:${attempt}`
            );
            const duration = state.logicalTime - startedAt;
            if (duration > node.timeout_ms) {
              result = undefined;
              throw new PureExecutionError("retry_attempt_timeout", `Retry attempt exceeded timeout_ms: ${duration}`, node.id);
            }
            record(state, program, node, depth, `succeeded_attempt:${attempt}`, result.outputs);
            break;
          } catch (error) {
            if (error && typeof error === "object" && "retryable" in error && (error as { retryable?: boolean }).retryable === false) throw error;
            lastError = error;
            record(state, program, node, depth, `failed_attempt:${attempt}`);
          }
        }
        if (!result) {
          record(state, program, node, depth, `exhausted:${lastError instanceof Error ? lastError.message : String(lastError)}`);
          current = node.on_error;
        } else {
          if (node.result) localState[node.result] = result.outputs;
          current = node.next;
        }
      } else if (node.kind === "timeout") {
        const before = state.logicalTime;
        const result = await executeProgram(
          resolveProgram(state, program, node.program),
          evaluateMap(node.input, scope),
          state,
          depth + 1,
          `${invocationPath}/timeout:${node.id}`
        );
        const duration = state.logicalTime - before;
        if (duration > node.timeout_ms) {
          record(state, program, node, depth, `timed_out:${duration}`);
          current = node.on_timeout;
        } else {
          if (node.result) localState[node.result] = result.outputs;
          record(state, program, node, depth, `completed_within:${duration}`, result.outputs);
          current = node.next;
        }
      } else if (node.kind === "cancel") {
        const reason = node.reason ? evaluateExpression(node.reason, scope) : "cancelled_by_program";
        record(state, program, node, depth, `cancelled:${String(reason)}`);
        return { status: "cancelled", outputs: {}, state: localState };
      } else if (node.kind === "compensate") {
        const receipt = evaluateExpression(node.receipt, scope);
        if (state.compensationExecutor) {
          await state.compensationExecutor(receipt, { program_id: program.id, node_id: node.id });
          state.externalEffectCount += 1;
          record(state, program, node, depth, "compensated", receipt);
        } else record(state, program, node, depth, "pure_compensation_recorded", receipt);
        current = node.next;
      } else if (node.kind === "emit") {
        const payload = node.payload === undefined ? null : evaluateExpression(node.payload, scope);
        state.emitted.push({ event: node.event, payload: clone(payload) });
        record(state, program, node, depth, `emitted:${node.event}`, payload);
        current = node.next;
      } else if (node.kind === "return") {
        const outputs = evaluateMap(node.values, scope);
        initializeSlots(program.outputs, outputs, "output");
        record(state, program, node, depth, "returned", outputs);
        return { status: "completed", outputs, state: localState };
      }
    } catch (error) {
      const target = routeError(program, node, error);
      if (!target) throw error;
      record(state, program, node, depth, `error_routed:${target}`);
      current = target;
    }
  }
  throw new PureExecutionError("missing_terminal", `Program ${program.id} ended without return or cancel`);
}

async function executeInternal(
  program: MiraiProgram,
  input: Record<string, unknown>,
  options: PureExecutionOptions,
  effectExecutor?: EffectExecutor,
  compensationExecutor?: CompensationExecutor
): Promise<ExecutionEpisode> {
  const execution: ExecutionState = {
    trace: [], emitted: [], steps: 0, iterations: 0, logicalTime: 0, root: program,
    registry: { [program.id]: program, ...(options.programs || {}) },
    adapters: options.adapters || DEFAULT_PURE_ADAPTERS,
    events: options.events || {},
    effectExecutor,
    compensationExecutor,
    externalEffectCount: 0
  };
  const result = await executeProgram(program, clone(input), execution, 0, `root:${program.id}`);
  const inputDigest = digestValue(input);
  const outputDigest = digestValue(result.outputs);
  const traceDigest = digestValue(execution.trace);
  return {
    contract_version: PURE_EPISODE_CONTRACT_VERSION,
    episode_id: `episode.${digestValue({ program: program.digest, input: inputDigest, trace: traceDigest }).slice(7, 23)}`,
    program_id: program.id,
    program_digest: program.digest,
    input_digest: inputDigest,
    replay_input: clone(input),
    status: result.status,
    outputs: result.outputs,
    output_digest: outputDigest,
    final_state: result.state,
    emitted_events: execution.emitted,
    trace: execution.trace,
    trace_digest: traceDigest,
    steps: execution.steps,
    logical_duration_ms: execution.logicalTime,
    effects_executed: execution.externalEffectCount > 0,
    canonical_write_allowed: false,
    limitations: ["Pure episodes contain no external effects or runtime authorization."]
  };
}

export async function executePure(program: MiraiProgram, input: Record<string, unknown>, options: PureExecutionOptions = {}): Promise<PureEpisode> {
  const episode = await executeInternal(program, input, options);
  if (episode.effects_executed) throw new PureExecutionError("pure_effect_boundary_broken", "Pure execution recorded an external effect");
  return episode as PureEpisode;
}

export async function executeWithEffects(
  program: MiraiProgram,
  input: Record<string, unknown>,
  effectExecutor: EffectExecutor,
  options: PureExecutionOptions = {},
  compensationExecutor?: CompensationExecutor
): Promise<ExecutionEpisode> {
  return executeInternal(program, input, options, effectExecutor, compensationExecutor);
}
