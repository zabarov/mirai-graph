import fs from "node:fs";
import path from "node:path";
import { digestValue } from "../core/canonical.js";
import { compileProgramFile } from "../program/compiler.js";
import { startGovernedRun, type ApprovalReceipt, type CapabilityPolicy } from "../runtime/index.js";
import { simulateActivationPlan } from "./simulator.js";
import { validateActivationPlan } from "./resolver.js";
import type { ActivationPlan } from "./types.js";

export interface ActivationRunOptions {
  sandbox: string;
  home?: string;
  base_dir?: string;
  input?: Record<string, unknown>;
  apply?: boolean;
  approvals?: Record<string, ApprovalReceipt>;
  policy?: CapabilityPolicy;
}

export interface ActivationPathRunResult {
  path_id: string;
  status: "completed" | "failed" | "blocked";
  run_id?: string;
  program_digest: string;
  trace_digest?: string;
  output_digest?: string;
  effects_executed: boolean;
  blocker?: string;
}

export interface ActivationRunResult {
  contract_version: "1.0.0";
  plan_digest: string;
  status: "completed" | "blocked";
  frontiers: string[][];
  path_results: ActivationPathRunResult[];
  successful_path_ids: string[];
  selected_success_path_id?: string;
  aggregate_trace_digest: string;
  effects_executed: boolean;
  canonical_write_allowed: false;
  learning_update_allowed: false;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
}

function resolveWithinBase(baseDir: string, reference: string): string {
  const resolved = path.resolve(baseDir, reference);
  const relative = path.relative(baseDir, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) return resolved;
  throw new Error(`activation_program_ref_outside_base:${reference}`);
}

function requiredSuccesses(plan: ActivationPlan): number {
  if (plan.join.policy === "quorum") return plan.join.quorum as number;
  if (plan.join.policy === "any_success_ordered") return Math.min(1, plan.activated_paths.length);
  return plan.activated_paths.length;
}

export async function runActivationPlan(plan: ActivationPlan, options: ActivationRunOptions): Promise<ActivationRunResult> {
  const validation = validateActivationPlan(plan);
  if (!validation.valid) throw new Error(`activation_plan_invalid:${validation.errors.join(",")}`);
  const schedule = simulateActivationPlan(plan);
  const byId = new Map(plan.activated_paths.map((item) => [item.id, item]));
  const baseDir = path.resolve(options.base_dir || process.cwd());
  const sandboxRoot = path.resolve(options.sandbox);
  fs.mkdirSync(sandboxRoot, { recursive: true });
  const results: ActivationPathRunResult[] = [];
  const startedAt = Date.now();

  for (const frontier of schedule.frontiers) {
    if (Date.now() - startedAt >= plan.budgets.max_duration_ms) {
      for (const pathId of frontier) {
        const activationPath = byId.get(pathId);
        results.push({
          path_id: pathId,
          status: "blocked",
          program_digest: activationPath?.program_digest || "",
          effects_executed: false,
          blocker: "activation_duration_budget_exceeded"
        });
      }
      break;
    }
    const frontierResults = await Promise.all(frontier.map(async (pathId): Promise<ActivationPathRunResult> => {
      const activationPath = byId.get(pathId);
      if (!activationPath) return { path_id: pathId, status: "blocked", program_digest: "", effects_executed: false, blocker: "activation_path_missing" };
      const failedDependency = activationPath.dependencies.find((dependency) => !results.some((item) => item.path_id === dependency && item.status === "completed"));
      if (failedDependency) {
        return {
          path_id: pathId,
          status: "blocked",
          program_digest: activationPath.program_digest,
          effects_executed: false,
          blocker: `activation_dependency_not_completed:${failedDependency}`
        };
      }
      try {
        const programPath = resolveWithinBase(baseDir, activationPath.program_ref);
        const program = compileProgramFile(programPath).program;
        if (program.digest !== activationPath.program_digest) throw new Error(`activation_program_digest_mismatch:${pathId}`);
        const sandbox = path.join(sandboxRoot, safeSegment(pathId));
        fs.mkdirSync(sandbox, { recursive: true });
        const runtimeResult = await startGovernedRun(program, options.input || {}, {
          home: options.home,
          sandbox,
          apply: options.apply === true,
          approval: options.approvals?.[pathId],
          policy: options.policy
        });
        return {
          path_id: pathId,
          status: runtimeResult.run.status === "completed" ? "completed" : runtimeResult.run.status === "blocked" ? "blocked" : "failed",
          run_id: runtimeResult.run.run_id,
          program_digest: program.digest,
          effects_executed: runtimeResult.episode?.effects_executed === true,
          ...(runtimeResult.episode ? { trace_digest: runtimeResult.episode.trace_digest, output_digest: runtimeResult.episode.output_digest } : {}),
          ...(runtimeResult.run.blockers.length ? { blocker: runtimeResult.run.blockers.join(",") } : {})
        };
      } catch (error) {
        return { path_id: pathId, status: "failed", program_digest: activationPath.program_digest, effects_executed: false, blocker: error instanceof Error ? error.message : String(error) };
      }
    }));
    results.push(...frontierResults.sort((a, b) => a.path_id.localeCompare(b.path_id)));
  }

  const successful = plan.join.deterministic_order.filter((id) => results.some((item) => item.path_id === id && item.status === "completed"));
  const required = requiredSuccesses(plan);
  const allPathsReachedTerminal = results.length === plan.activated_paths.length;
  const status = plan.join.policy === "collect"
    ? (allPathsReachedTerminal ? "completed" as const : "blocked" as const)
    : (successful.length >= required ? "completed" as const : "blocked" as const);
  const effectsExecuted = results.some((item) => item.effects_executed);
  const traceBasis = {
    plan_digest: plan.digest,
    status,
    paths: results.map((item) => ({ path_id: item.path_id, status: item.status, program_digest: item.program_digest, trace_digest: item.trace_digest, output_digest: item.output_digest, effects_executed: item.effects_executed, blocker: item.blocker }))
  };
  return {
    contract_version: "1.0.0",
    plan_digest: plan.digest,
    status,
    frontiers: schedule.frontiers,
    path_results: results,
    successful_path_ids: successful,
    ...(plan.join.policy === "any_success_ordered" && successful[0] ? { selected_success_path_id: successful[0] } : {}),
    aggregate_trace_digest: digestValue(traceBasis),
    effects_executed: effectsExecuted,
    canonical_write_allowed: false,
    learning_update_allowed: false
  };
}
