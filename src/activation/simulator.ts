import { digestValue } from "../core/canonical.js";
import { validateActivationPlan } from "./resolver.js";
import type { ActivationPlan } from "./types.js";

export interface ActivationSimulation {
  contract_version: "1.0.0";
  plan_digest: string;
  frontiers: string[][];
  ordered_paths: string[];
  join_result: { policy: ActivationPlan["join"]["policy"]; required_successes: number };
  decisions_reproduced: true;
  effects_executed: false;
  canonical_write_allowed: false;
  trace_digest: string;
}

export function simulateActivationPlan(plan: ActivationPlan): ActivationSimulation {
  const validation = validateActivationPlan(plan);
  if (!validation.valid) throw new Error(`activation_plan_invalid:${validation.errors.join(",")}`);
  const remaining = new Set(plan.activated_paths.map((item) => item.id));
  const completed = new Set<string>();
  const frontiers: string[][] = [];
  while (remaining.size) {
    const frontier = [...remaining]
      .filter((id) => plan.dependency_dag.filter((edge) => edge.to === id).every((edge) => completed.has(edge.from)))
      .sort();
    if (!frontier.length) throw new Error("activation_dependency_cycle");
    if (frontier.length > plan.budgets.max_parallel) throw new Error("activation_parallel_budget_exceeded");
    frontiers.push(frontier);
    for (const id of frontier) { remaining.delete(id); completed.add(id); }
  }
  const ordered = frontiers.flat();
  const requiredSuccesses = plan.join.policy === "quorum"
    ? plan.join.quorum as number
    : plan.join.policy === "any_success_ordered" ? Math.min(1, ordered.length) : ordered.length;
  const candidate = {
    contract_version: "1.0.0" as const,
    plan_digest: plan.digest,
    frontiers,
    ordered_paths: ordered,
    join_result: { policy: plan.join.policy, required_successes: requiredSuccesses },
    decisions_reproduced: true as const,
    effects_executed: false as const,
    canonical_write_allowed: false as const
  };
  return { ...candidate, trace_digest: digestValue(candidate) };
}
