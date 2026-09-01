import { digestValue, withoutDigest } from "../core/canonical.js";
import { relationApplies, validateComponentPackage } from "../components/validator.js";
import type { ComponentInstance, ContextualBinding, RelationFact } from "../components/types.js";
import {
  ACTIVATION_PLAN_CONTRACT_VERSION,
  type ActivationGraphSnapshot,
  type ActivationPath,
  type ActivationPlan,
  type ActivationResolutionOptions,
  type ActivationSignal
} from "./types.js";

const DEFAULT_BUDGETS: ActivationPlan["budgets"] = {
  max_nodes: 1000, max_depth: 32, max_fan_out: 64, max_iterations: 1000, max_parallel: 16, max_duration_ms: 300000
};

function bindingApplies(binding: ContextualBinding, signal: ActivationSignal): boolean {
  if (binding.operation !== signal.operation) return false;
  if (binding.scope && binding.scope !== signal.scope) return false;
  for (const [key, expected] of Object.entries(binding.conditions || {})) if (signal.values?.[key] !== expected) return false;
  return true;
}

function relationEndpoint(fact: RelationFact, role: string): string | undefined {
  return fact.participants.find((item) => item.role === role)?.ref;
}

function depthOf(nodes: string[], edges: Array<{ from: string; to: string }>): number {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (node: string): number => {
    if (memo.has(node)) return memo.get(node) as number;
    if (visiting.has(node)) throw new Error("activation_dependency_cycle");
    visiting.add(node);
    const parents = edges.filter((edge) => edge.to === node).map((edge) => edge.from);
    const value = parents.length ? 1 + Math.max(...parents.map(visit)) : 1;
    visiting.delete(node); memo.set(node, value); return value;
  };
  return Math.max(0, ...nodes.map(visit));
}

function assertDigest(value: string, label: string): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${label}_invalid_digest`);
}

export function resolveActivationPlan(snapshot: ActivationGraphSnapshot, signal: ActivationSignal, options: ActivationResolutionOptions = {}): ActivationPlan {
  assertDigest(snapshot.graph_snapshot_digest, "graph_snapshot");
  assertDigest(snapshot.policy_digest, "policy");
  const computedSnapshotDigest = digestValue({ id: snapshot.id, components: snapshot.components, relation_facts: snapshot.relation_facts });
  if (computedSnapshotDigest !== snapshot.graph_snapshot_digest) throw new Error(`graph_snapshot_digest_mismatch:${snapshot.graph_snapshot_digest}:${computedSnapshotDigest}`);
  const componentValidation = validateComponentPackage(snapshot.components);
  if (!componentValidation.valid) throw new Error(`component_package_invalid:${componentValidation.errors.join(",")}`);
  const budgets = { ...DEFAULT_BUDGETS, ...(options.budgets || {}) };
  if (Object.values(budgets).some((value) => !Number.isInteger(value) || value < 1)) throw new Error("activation_budget_invalid");

  const selectedFacts: RelationFact[] = [];
  const blockedFacts: ActivationPlan["blocked_relation_facts"] = [];
  for (const fact of [...snapshot.relation_facts].sort((a, b) => a.id.localeCompare(b.id))) {
    if (relationApplies(fact, { now: signal.now, scope: signal.scope, values: signal.values, signal_type: signal.type })) selectedFacts.push(fact);
    else blockedFacts.push({ id: fact.id, reason: "context_not_applicable" });
  }

  const instances = snapshot.components.component_instances
    .filter((item) => !signal.component_refs?.length || signal.component_refs.includes(item.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const implementations = new Map(snapshot.components.program_implementations.map((item) => [item.id, item]));
  const inhibitors = new Map<string, string>();
  for (const fact of selectedFacts.filter((item) => item.type === "inhibits")) {
    const blockedComponent = relationEndpoint(fact, "blocked_component");
    if (blockedComponent) inhibitors.set(blockedComponent, fact.id);
  }
  const activated: ActivationPath[] = [];
  const blockedPaths: ActivationPlan["blocked_paths"] = [];
  for (const instance of instances) {
    const inhibitor = inhibitors.get(instance.id);
    if (inhibitor) {
      blockedPaths.push({ id: `${instance.id}:${signal.operation}`, reason: `inhibited_by_relation:${inhibitor}` });
      continue;
    }
    const candidates = snapshot.components.contextual_bindings
      .filter((binding) => binding.component_type === instance.instance_of && bindingApplies(binding, signal))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    if (!candidates.length) {
      blockedPaths.push({ id: `${instance.id}:${signal.operation}`, reason: "no_applicable_binding" });
      continue;
    }
    const top = candidates.filter((item) => item.priority === candidates[0]?.priority);
    if (top.length !== 1) throw new Error(`ambiguous_dispatch:${instance.id}:${top.map((item) => item.id).join(",")}`);
    const binding = top[0] as ContextualBinding;
    const implementation = implementations.get(binding.implementation);
    if (!implementation) throw new Error(`missing_implementation:${binding.implementation}`);
    activated.push({
      id: `path.${instance.id}.${binding.operation}`,
      component_instance: instance.id,
      component_type: instance.instance_of,
      operation: binding.operation,
      implementation: implementation.id,
      program_ref: implementation.program_ref,
      program_digest: implementation.program_digest,
      priority: binding.priority,
      dependencies: []
    });
  }
  if (activated.length > budgets.max_nodes) throw new Error("activation_node_budget_exceeded");

  const pathByComponent = new Map(activated.map((item) => [item.component_instance, item.id]));
  const edges: Array<{ from: string; to: string }> = [];
  for (const fact of selectedFacts.filter((item) => item.type === "depends_on")) {
    const dependent = relationEndpoint(fact, "dependent");
    const prerequisite = relationEndpoint(fact, "prerequisite");
    const from = prerequisite ? pathByComponent.get(prerequisite) : undefined;
    const to = dependent ? pathByComponent.get(dependent) : undefined;
    if (from && to && from !== to) edges.push({ from, to });
  }
  const uniqueEdges = [...new Map(edges.map((item) => [`${item.from}|${item.to}`, item])).values()].sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));
  for (const item of activated) item.dependencies = uniqueEdges.filter((edge) => edge.to === item.id).map((edge) => edge.from).sort();
  const maxDepth = depthOf(activated.map((item) => item.id), uniqueEdges);
  if (maxDepth > budgets.max_depth) throw new Error("activation_depth_budget_exceeded");
  const fanOut = Math.max(0, ...activated.map((item) => uniqueEdges.filter((edge) => edge.from === item.id).length));
  if (fanOut > budgets.max_fan_out) throw new Error("activation_fan_out_budget_exceeded");
  const joinPolicy = options.join || "all";
  if (joinPolicy === "quorum" && (!options.quorum || options.quorum < 1 || options.quorum > activated.length)) throw new Error("activation_quorum_invalid");
  const capabilities = new Set<string>();
  for (const path of activated) {
    const operation = snapshot.components.operation_contracts.find((item) => item.id === path.operation);
    for (const capability of operation?.required_capabilities || []) capabilities.add(capability);
  }
  const candidate = {
    contract_version: ACTIVATION_PLAN_CONTRACT_VERSION,
    id: `activation.${signal.id}`,
    signal,
    graph_snapshot_digest: snapshot.graph_snapshot_digest,
    policy_digest: snapshot.policy_digest,
    selected_relation_fact_ids: selectedFacts.map((item) => item.id).sort(),
    blocked_relation_facts: blockedFacts,
    activated_paths: activated.sort((a, b) => a.id.localeCompare(b.id)),
    blocked_paths: blockedPaths.sort((a, b) => a.id.localeCompare(b.id)),
    dependency_dag: uniqueEdges,
    join: { policy: joinPolicy, ...(joinPolicy === "quorum" ? { quorum: options.quorum } : {}), deterministic_order: activated.map((item) => item.id).sort() },
    budgets,
    required_capabilities: [...capabilities].sort(),
    required_approvals: [...capabilities].filter((item) => item !== "pure").map((item) => `approval:${item}`).sort(),
    decision_explanations: [
      `Selected ${activated.length} path(s) for operation ${signal.operation} in scope ${signal.scope}.`,
      `Applied ${selectedFacts.length} of ${snapshot.relation_facts.length} relation fact(s).`,
      `Plan is bound to graph ${snapshot.graph_snapshot_digest} and policy ${snapshot.policy_digest}.`
    ],
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}

export function validateActivationPlan(plan: ActivationPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (plan.contract_version !== ACTIVATION_PLAN_CONTRACT_VERSION) errors.push("unsupported_activation_contract");
  if (plan.canonical_write_allowed !== false) errors.push("canonical_write_must_be_false");
  if (digestValue(withoutDigest(plan as unknown as Record<string, unknown>)) !== plan.digest) errors.push("activation_plan_digest_mismatch");
  const ids = new Set(plan.activated_paths.map((item) => item.id));
  for (const edge of plan.dependency_dag) if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`activation_unknown_dependency:${edge.from}:${edge.to}`);
  try { depthOf([...ids], plan.dependency_dag); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  if (plan.activated_paths.length > plan.budgets.max_nodes) errors.push("activation_node_budget_exceeded");
  if (plan.join.policy === "quorum" && (!plan.join.quorum || plan.join.quorum > plan.activated_paths.length)) errors.push("activation_quorum_invalid");
  return { valid: errors.length === 0, errors: errors.sort() };
}
