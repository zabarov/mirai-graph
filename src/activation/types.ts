import type { ComponentPackage, RelationFact } from "../components/types.js";

export const ACTIVATION_PLAN_CONTRACT_VERSION = "1.0.0" as const;

export type JoinPolicy = "all" | "collect" | "any_success_ordered" | "quorum";

export interface ActivationSignal {
  id: string;
  type: string;
  goal: string;
  scope: string;
  now: string;
  operation: string;
  component_refs?: string[];
  values?: Record<string, unknown>;
}

export interface ActivationGraphSnapshot {
  id: string;
  graph_snapshot_digest: string;
  policy_digest: string;
  components: ComponentPackage;
  relation_facts: RelationFact[];
}

export interface ActivationPath {
  id: string;
  component_instance: string;
  component_type: string;
  operation: string;
  implementation: string;
  program_ref: string;
  program_digest: string;
  priority: number;
  dependencies: string[];
}

export interface ActivationPlan {
  contract_version: typeof ACTIVATION_PLAN_CONTRACT_VERSION;
  id: string;
  signal: ActivationSignal;
  graph_snapshot_digest: string;
  policy_digest: string;
  selected_relation_fact_ids: string[];
  blocked_relation_facts: Array<{ id: string; reason: string }>;
  activated_paths: ActivationPath[];
  blocked_paths: Array<{ id: string; reason: string }>;
  dependency_dag: Array<{ from: string; to: string }>;
  join: { policy: JoinPolicy; quorum?: number; deterministic_order: string[] };
  budgets: { max_nodes: number; max_depth: number; max_fan_out: number; max_iterations: number; max_parallel: number; max_duration_ms: number };
  required_capabilities: string[];
  required_approvals: string[];
  decision_explanations: string[];
  canonical_write_allowed: false;
  digest: string;
}

export interface ActivationResolutionOptions {
  join?: JoinPolicy;
  quorum?: number;
  budgets?: Partial<ActivationPlan["budgets"]>;
}
