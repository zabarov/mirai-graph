import type { Expression, TypeSpec } from "../program/types.js";

export const TECHNOLOGY_DRAFT_CONTRACT_VERSION = "1.0.0" as const;
export const TECHNOLOGY_QUALIFICATION_CONTRACT_VERSION = "1.0.0" as const;
export const HYBRID_TECHNOLOGY_PLAN_CONTRACT_VERSION = "1.0.0" as const;

export type OperationClass = "executable" | "verifiable" | "advisory" | "decision" | "unsupported";
export type QualificationAcceptance = "unreviewed" | "owner_accepted" | "tester_accepted";
export type TechnologyQualificationStatus = "instruction_only" | "program_candidate" | "hybrid_ready" | "executable_ready" | "blocked";

export interface TechnologyDiagnostic {
  code: string;
  severity: "warning" | "blocking";
  message: string;
  source_span?: { file: string; line: number };
}

export type TechnologyStep =
  | { id: string; kind: "action"; operation: string; program_ref?: string; adapter?: string; effects: string[]; capability?: string; next: string; on_error: string; source_line?: number }
  | { id: string; kind: "branch"; condition: Expression; then: string; else: string; source_line?: number }
  | { id: string; kind: "foreach"; items: Expression; item: string; program_ref: string; max_iterations: number; next: string; source_line?: number }
  | { id: string; kind: "parallel"; branches: Array<{ id: string; program_ref: string }>; join: "all" | "collect" | "any_success_ordered" | "quorum"; quorum?: number; max_parallel: number; next: string; source_line?: number }
  | { id: string; kind: "await"; event: string; deadline_ms: number; on_timeout: string; next: string; source_line?: number }
  | { id: string; kind: "return"; values: Record<string, Expression>; source_line?: number };

export interface TechnologyDraft {
  contract_version: typeof TECHNOLOGY_DRAFT_CONTRACT_VERSION;
  id: string;
  version: string;
  goal: string;
  roles: string[];
  inputs: Array<{ id: string; type: TypeSpec; required?: boolean; default?: unknown }>;
  outputs: Array<{ id: string; type: TypeSpec; required?: boolean }>;
  state: Array<{ id: string; type: TypeSpec; required?: boolean; default?: unknown }>;
  imports: Array<{ alias: string; ref: string; digest: string }>;
  steps: TechnologyStep[];
  entry: string;
  gates: string[];
  policies: {
    budgets: { max_steps: number; max_depth: number; max_iterations: number; max_parallel: number; max_duration_ms: number };
    allowed_effects: string[];
    canonical_write_allowed: false;
  };
  terminal_conditions: string[];
  diagnostics: TechnologyDiagnostic[];
  source_ref: string;
  confidence: number;
  canonical_write_allowed: false;
}

export interface OperationQualificationBinding {
  step_id: string;
  classification: OperationClass;
  acceptance: QualificationAcceptance;
  acceptance_ref?: string;
  reason: string;
  program_ref?: string;
  adapter?: string;
  effects?: string[];
  capability?: string;
  verification_ref?: string;
  owner_ref?: string;
}

export interface QualifiedTechnologyOperation extends OperationQualificationBinding {
  operation: string;
  blockers: string[];
}

export interface TechnologyQualificationResult {
  contract_version: typeof TECHNOLOGY_QUALIFICATION_CONTRACT_VERSION;
  technology_id: string;
  technology_version: string;
  source_ref: string;
  draft_digest: string;
  status: TechnologyQualificationStatus;
  operations: QualifiedTechnologyOperation[];
  blocking_diagnostics: TechnologyDiagnostic[];
  simulation_allowed: boolean;
  activation_allowed: boolean;
  canonical_write_allowed: false;
  digest: string;
}

export type HybridOperationMode = "program_operation" | "verification_gate" | "advisory_checkpoint" | "decision_checkpoint" | "unsupported_blocker";

export interface HybridTechnologyOperation {
  step_id: string;
  operation: string;
  classification: OperationClass;
  acceptance: QualificationAcceptance;
  acceptance_ref?: string;
  reason: string;
  mode: HybridOperationMode;
  next: string;
  on_error: string;
  program_ref?: string;
  adapter?: string;
  effects: string[];
  capability?: string;
  verification_ref?: string;
  owner_ref?: string;
}

export interface HybridTechnologyPlan {
  contract_version: typeof HYBRID_TECHNOLOGY_PLAN_CONTRACT_VERSION;
  id: string;
  version: string;
  goal: string;
  source_ref: string;
  draft_digest: string;
  qualification_digest: string;
  qualification_status: Exclude<TechnologyQualificationStatus, "program_candidate" | "blocked">;
  entry: string;
  operations: HybridTechnologyOperation[];
  control_steps: Exclude<TechnologyStep, { kind: "action" }>[];
  gates: string[];
  terminal_conditions: string[];
  runtime_program_digest?: string;
  requires_human_coordination: boolean;
  activation_allowed: boolean;
  canonical_write_allowed: false;
  digest: string;
}
