import type { Expression, TypeSpec } from "../program/types.js";

export const TECHNOLOGY_DRAFT_CONTRACT_VERSION = "1.0.0" as const;

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
