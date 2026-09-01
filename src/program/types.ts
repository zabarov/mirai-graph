export const PROGRAM_CONTRACT_VERSION = "1.0.0" as const;

export type PrimitiveType =
  | "boolean" | "string" | "int64" | "decimal" | "timestamp" | "duration"
  | "identifier" | "reference" | "error";

export type TypeSpec = PrimitiveType
  | { kind: "enum"; values: string[] }
  | { kind: "record"; fields: Record<string, TypeSpec> }
  | { kind: "list"; items: TypeSpec }
  | { kind: "map"; values: TypeSpec }
  | { kind: "option"; value: TypeSpec }
  | { kind: "result"; ok: TypeSpec; error?: TypeSpec };

export type Expression =
  | { op: "literal"; value: unknown }
  | { op: "ref"; path: string }
  | { op: "get"; target: Expression; key: string }
  | { op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "and" | "or" | "in"; left: Expression; right: Expression }
  | { op: "not"; value: Expression }
  | { op: "coalesce"; values: Expression[] };

export interface SlotDefinition {
  id: string;
  type: TypeSpec;
  required?: boolean;
  default?: unknown;
}

export interface ProgramImport {
  alias: string;
  ref: string;
  digest: string;
}

export interface NodeBase {
  id: string;
  kind: string;
  next?: string;
}

export interface CallNode extends NodeBase {
  kind: "call";
  target:
    | { kind: "adapter"; adapter: string; operation: string }
    | { kind: "program"; program: string };
  args?: Record<string, Expression>;
  result?: string;
  effects?: string[];
  capability?: string;
  on_error?: string;
}

export interface BranchNode extends NodeBase {
  kind: "branch";
  condition: Expression;
  then: string;
  else: string;
}

export interface MatchNode extends NodeBase {
  kind: "match";
  value: Expression;
  cases: Array<{ equals: unknown; to: string }>;
  default: string;
}

export interface ForeachNode extends NodeBase {
  kind: "foreach";
  items: Expression;
  item: string;
  program: string;
  input?: Record<string, Expression>;
  result?: string;
  max_iterations: number;
}

export interface ParallelNode extends NodeBase {
  kind: "parallel";
  branches: Array<{ id: string; program: string; input?: Record<string, Expression> }>;
  max_parallel: number;
  merge: "array" | "object" | "all_success";
  result?: string;
}

export interface AwaitNode extends NodeBase {
  kind: "await";
  event: string;
  deadline_ms: number;
  result?: string;
  on_timeout: string;
}

export interface RetryNode extends NodeBase {
  kind: "retry";
  program: string;
  input?: Record<string, Expression>;
  max_attempts: number;
  backoff_ms: number;
  timeout_ms: number;
  result?: string;
  on_error: string;
}

export interface TimeoutNode extends NodeBase {
  kind: "timeout";
  program: string;
  input?: Record<string, Expression>;
  timeout_ms: number;
  result?: string;
  on_timeout: string;
}

export interface CancelNode extends NodeBase {
  kind: "cancel";
  target_run?: Expression;
  reason?: Expression;
}

export interface CompensateNode extends NodeBase {
  kind: "compensate";
  receipt: Expression;
  on_error?: string;
}

export interface EmitNode extends NodeBase {
  kind: "emit";
  event: string;
  payload?: Expression;
}

export interface ReturnNode extends NodeBase {
  kind: "return";
  values?: Record<string, Expression>;
}

export type ProgramNode = CallNode | BranchNode | MatchNode | ForeachNode |
  ParallelNode | AwaitNode | RetryNode | TimeoutNode | CancelNode |
  CompensateNode | EmitNode | ReturnNode;

export interface ExecutionBudgets {
  max_steps: number;
  max_depth: number;
  max_iterations: number;
  max_parallel: number;
  max_duration_ms: number;
}

export interface MiraiProgram {
  contract_version: typeof PROGRAM_CONTRACT_VERSION;
  id: string;
  version: string;
  imports: ProgramImport[];
  inputs: SlotDefinition[];
  outputs: SlotDefinition[];
  state: SlotDefinition[];
  nodes: ProgramNode[];
  entry: string;
  error_routes: Array<{ error: string; to: string }>;
  policies: {
    budgets: ExecutionBudgets;
    allowed_effects: string[];
    canonical_write_allowed: false;
  };
  source_map: Record<string, { file: string; line?: number }>;
  digest: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
