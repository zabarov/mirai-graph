import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalJson } from "../core/canonical.js";
import { programDigest } from "./digest.js";
import { MIRAI_PROGRAM_SCHEMA } from "./schema.js";
import type { Expression, MiraiProgram, ProgramNode, TypeSpec, ValidationResult } from "./types.js";

const ALLOWED_EFFECTS = new Set([
  "pure", "repository_read", "git_read", "workspace_patch", "process_run", "human_approval"
]);
const NODE_KINDS = new Set([
  "call", "branch", "match", "foreach", "parallel", "await", "retry",
  "timeout", "cancel", "compensate", "emit", "return"
]);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateShape = ajv.compile(MIRAI_PROGRAM_SCHEMA);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function typeKey(type: TypeSpec | undefined): string | null {
  return type === undefined ? null : canonicalJson(type);
}

function validateType(type: unknown, label: string, errors: string[]): type is TypeSpec {
  const primitives = new Set(["boolean", "string", "int64", "decimal", "timestamp", "duration", "identifier", "reference", "error"]);
  if (typeof type === "string") {
    if (!primitives.has(type)) errors.push(`${label}:unknown_type:${type}`);
    return primitives.has(type);
  }
  if (!isRecord(type) || typeof type.kind !== "string") {
    errors.push(`${label}:invalid_type_spec`);
    return false;
  }
  if (type.kind === "enum") {
    if (!Array.isArray(type.values) || type.values.length === 0 || type.values.some((item) => typeof item !== "string")) errors.push(`${label}:invalid_enum`);
    return true;
  }
  if (type.kind === "record") {
    if (!isRecord(type.fields)) errors.push(`${label}:invalid_record_fields`);
    else for (const [key, value] of Object.entries(type.fields)) validateType(value, `${label}.${key}`, errors);
    return true;
  }
  if (type.kind === "list") return validateType(type.items, `${label}.items`, errors);
  if (type.kind === "map") return validateType(type.values, `${label}.values`, errors);
  if (type.kind === "option") return validateType(type.value, `${label}.value`, errors);
  if (type.kind === "result") {
    validateType(type.ok, `${label}.ok`, errors);
    if (type.error !== undefined) validateType(type.error, `${label}.error`, errors);
    return true;
  }
  errors.push(`${label}:unknown_type_kind:${type.kind}`);
  return false;
}

function valueMatchesType(value: unknown, type: TypeSpec): boolean {
  if (typeof type === "string") {
    if (type === "boolean") return typeof value === "boolean";
    if (type === "int64") return Number.isSafeInteger(value);
    if (type === "decimal") return typeof value === "string" && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value);
    if (["string", "timestamp", "duration", "identifier", "reference", "error"].includes(type)) return typeof value === "string";
    return false;
  }
  if (type.kind === "enum") return typeof value === "string" && type.values.includes(value);
  if (type.kind === "list") return Array.isArray(value) && value.every((item) => valueMatchesType(item, type.items));
  if (type.kind === "map") return isRecord(value) && Object.values(value).every((item) => valueMatchesType(item, type.values));
  if (type.kind === "option") return value === null || valueMatchesType(value, type.value);
  if (type.kind === "record") return isRecord(value) && Object.entries(type.fields).every(([key, fieldType]) => key in value && valueMatchesType(value[key], fieldType));
  if (type.kind === "result") return isRecord(value) && (("ok" in value && valueMatchesType(value.ok, type.ok)) || ("error" in value && valueMatchesType(value.error, type.error || "error")));
  return false;
}

function inferLiteral(value: unknown): TypeSpec | undefined {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  if (Number.isSafeInteger(value)) return "int64";
  if (Array.isArray(value)) {
    const inferred = value.map(inferLiteral).filter((item): item is TypeSpec => item !== undefined);
    if (inferred.length === value.length && inferred.every((item) => typeKey(item) === typeKey(inferred[0]))) return { kind: "list", items: inferred[0] || "string" };
  }
  return undefined;
}

function inferExpression(expr: unknown, env: Map<string, TypeSpec>, errors: string[], label: string): TypeSpec | undefined {
  if (!isRecord(expr) || typeof expr.op !== "string") {
    errors.push(`${label}:invalid_expression`);
    return undefined;
  }
  if (expr.op === "literal") return inferLiteral(expr.value);
  if (expr.op === "ref") {
    if (typeof expr.path !== "string") { errors.push(`${label}:invalid_ref`); return undefined; }
    const result = env.get(expr.path);
    if (!result) errors.push(`${label}:unknown_ref:${expr.path}`);
    return result;
  }
  if (expr.op === "get") {
    const target = inferExpression(expr.target, env, errors, `${label}.target`);
    if (!target || typeof target === "string" || target.kind !== "record" || typeof expr.key !== "string" || !target.fields[expr.key]) {
      errors.push(`${label}:invalid_get`);
      return undefined;
    }
    return target.fields[expr.key];
  }
  if (["eq", "ne", "lt", "lte", "gt", "gte", "and", "or", "in"].includes(expr.op)) {
    const left = inferExpression(expr.left, env, errors, `${label}.left`);
    const right = inferExpression(expr.right, env, errors, `${label}.right`);
    if (expr.op === "and" || expr.op === "or") {
      if (left !== "boolean" || right !== "boolean") errors.push(`${label}:boolean_operands_required`);
    } else if (left && right && expr.op !== "in" && typeKey(left) !== typeKey(right)) errors.push(`${label}:operand_type_mismatch`);
    return "boolean";
  }
  if (expr.op === "not") {
    if (inferExpression(expr.value, env, errors, `${label}.value`) !== "boolean") errors.push(`${label}:boolean_operand_required`);
    return "boolean";
  }
  if (expr.op === "coalesce") {
    if (!Array.isArray(expr.values) || expr.values.length === 0) { errors.push(`${label}:coalesce_values_required`); return undefined; }
    const types = expr.values.map((value, index) => inferExpression(value, env, errors, `${label}.values[${index}]`)).filter((item): item is TypeSpec => item !== undefined);
    if (types.some((item) => typeKey(item) !== typeKey(types[0]))) errors.push(`${label}:coalesce_type_mismatch`);
    return types[0];
  }
  errors.push(`${label}:unknown_expression_op:${expr.op}`);
  return undefined;
}

function requireRef(value: unknown, refs: Set<string>, label: string, errors: string[]): void {
  if (typeof value !== "string" || !refs.has(value)) errors.push(`${label}:unknown_node_ref:${String(value)}`);
}

function validateNode(node: ProgramNode, refs: Set<string>, env: Map<string, TypeSpec>, program: MiraiProgram, errors: string[]): void {
  const label = `node:${node.id}`;
  if (!NODE_KINDS.has(node.kind)) { errors.push(`${label}:unknown_kind:${node.kind}`); return; }
  if (node.next !== undefined) requireRef(node.next, refs, `${label}.next`, errors);

  if (node.kind === "call") {
    if (!isRecord(node.target) || !["adapter", "program"].includes(String(node.target.kind))) errors.push(`${label}:invalid_target`);
    if (node.target?.kind === "adapter" && (!node.target.adapter || !node.target.operation)) errors.push(`${label}:adapter_binding_required`);
    if (node.target?.kind === "program" && !node.target.program) errors.push(`${label}:program_ref_required`);
    for (const [key, value] of Object.entries(node.args || {})) inferExpression(value, env, errors, `${label}.args.${key}`);
    for (const effect of node.effects || []) {
      if (!ALLOWED_EFFECTS.has(effect)) errors.push(`${label}:unknown_effect:${effect}`);
      if (!program.policies.allowed_effects.includes(effect)) errors.push(`${label}:effect_not_allowed:${effect}`);
    }
    if (node.effects?.some((effect) => effect !== "pure") && !node.capability) errors.push(`${label}:capability_required`);
    if (node.on_error !== undefined) requireRef(node.on_error, refs, `${label}.on_error`, errors);
  } else if (node.kind === "branch") {
    if (inferExpression(node.condition, env, errors, `${label}.condition`) !== "boolean") errors.push(`${label}:condition_must_be_boolean`);
    requireRef(node.then, refs, `${label}.then`, errors); requireRef(node.else, refs, `${label}.else`, errors);
  } else if (node.kind === "match") {
    inferExpression(node.value, env, errors, `${label}.value`);
    if (!Array.isArray(node.cases) || node.cases.length === 0) errors.push(`${label}:cases_required`);
    else node.cases.forEach((item, index) => requireRef(item.to, refs, `${label}.cases[${index}]`, errors));
    requireRef(node.default, refs, `${label}.default`, errors);
  } else if (node.kind === "foreach") {
    const itemType = inferExpression(node.items, env, errors, `${label}.items`);
    if (!itemType || typeof itemType === "string" || itemType.kind !== "list") errors.push(`${label}:items_must_be_list`);
    if (!Number.isInteger(node.max_iterations) || node.max_iterations < 1 || node.max_iterations > program.policies.budgets.max_iterations) errors.push(`${label}:unbounded_foreach`);
    if (!node.program || !node.item) errors.push(`${label}:program_and_item_required`);
  } else if (node.kind === "parallel") {
    if (!Array.isArray(node.branches) || node.branches.length === 0) errors.push(`${label}:branches_required`);
    if (!Number.isInteger(node.max_parallel) || node.max_parallel < 1 || node.max_parallel > program.policies.budgets.max_parallel) errors.push(`${label}:parallel_budget_invalid`);
  } else if (node.kind === "await") {
    if (!node.event || !Number.isInteger(node.deadline_ms) || node.deadline_ms < 1) errors.push(`${label}:event_and_deadline_required`);
    requireRef(node.on_timeout, refs, `${label}.on_timeout`, errors);
  } else if (node.kind === "retry") {
    if (!node.program || !Number.isInteger(node.max_attempts) || node.max_attempts < 1 || node.max_attempts > program.policies.budgets.max_iterations) errors.push(`${label}:retry_budget_invalid`);
    if (!Number.isInteger(node.timeout_ms) || node.timeout_ms < 1 || !Number.isInteger(node.backoff_ms) || node.backoff_ms < 0) errors.push(`${label}:retry_timing_invalid`);
    requireRef(node.on_error, refs, `${label}.on_error`, errors);
  } else if (node.kind === "timeout") {
    if (!node.program || !Number.isInteger(node.timeout_ms) || node.timeout_ms < 1) errors.push(`${label}:timeout_invalid`);
    requireRef(node.on_timeout, refs, `${label}.on_timeout`, errors);
  } else if (node.kind === "compensate") {
    inferExpression(node.receipt, env, errors, `${label}.receipt`);
    if (node.on_error !== undefined) requireRef(node.on_error, refs, `${label}.on_error`, errors);
  } else if (node.kind === "emit") {
    if (!node.event) errors.push(`${label}:event_required`);
    if (node.payload !== undefined) inferExpression(node.payload, env, errors, `${label}.payload`);
  } else if (node.kind === "return") {
    for (const output of program.outputs) {
      const expr = node.values?.[output.id];
      if (output.required !== false && !expr) errors.push(`${label}:missing_output:${output.id}`);
      if (expr) {
        const actual = inferExpression(expr, env, errors, `${label}.values.${output.id}`);
        if (actual && typeKey(actual) !== typeKey(output.type)) errors.push(`${label}:output_type_mismatch:${output.id}`);
      }
    }
  }
}

export function validateProgram(value: unknown, options: { verifyDigest?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!validateShape(value)) errors.push(...(validateShape.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
  if (!isRecord(value)) return { valid: false, errors, warnings };
  const program = value as unknown as MiraiProgram;
  if (!Array.isArray(program.nodes) || !program.policies?.budgets) return { valid: false, errors, warnings };

  const ids = new Set<string>();
  for (const node of program.nodes) {
    if (ids.has(node.id)) errors.push(`duplicate_node:${node.id}`);
    ids.add(node.id);
  }
  requireRef(program.entry, ids, "entry", errors);

  const env = new Map<string, TypeSpec>();
  for (const [group, slots] of [["input", program.inputs], ["state", program.state]] as const) {
    const seen = new Set<string>();
    for (const slot of slots || []) {
      if (seen.has(slot.id)) errors.push(`duplicate_${group}:${slot.id}`);
      seen.add(slot.id);
      if (validateType(slot.type, `${group}:${slot.id}`, errors)) {
        env.set(`${group}.${slot.id}`, slot.type);
        if (slot.default !== undefined && !valueMatchesType(slot.default, slot.type)) errors.push(`${group}:${slot.id}:default_type_mismatch`);
      }
    }
  }
  for (const slot of program.outputs || []) validateType(slot.type, `output:${slot.id}`, errors);

  for (const effect of program.policies.allowed_effects || []) if (!ALLOWED_EFFECTS.has(effect)) errors.push(`unknown_allowed_effect:${effect}`);
  if (program.policies.canonical_write_allowed !== false) errors.push("canonical_write_must_be_false");
  for (const node of program.nodes) validateNode(node, ids, env, program, errors);
  for (const route of program.error_routes || []) requireRef(route.to, ids, `error_route:${route.error}`, errors);
  for (const node of program.nodes) if (!program.source_map?.[node.id]) errors.push(`source_map_missing:${node.id}`);

  if (options.verifyDigest !== false && typeof program.digest === "string") {
    const expected = programDigest(program);
    if (program.digest !== expected) errors.push(`digest_mismatch:${program.digest}:${expected}`);
  }
  if (program.nodes.length > program.policies.budgets.max_steps) warnings.push("static_node_count_exceeds_step_budget");
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(), warnings: [...new Set(warnings)].sort() };
}

export { ALLOWED_EFFECTS };
