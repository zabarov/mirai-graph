import { canonicalJson } from "../core/canonical.js";
import type { Expression } from "../program/types.js";

export interface EvaluationScope {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  local?: Record<string, unknown>;
}

export class ExpressionEvaluationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function resolvePath(scope: EvaluationScope, path: string): unknown {
  const parts = path.split(".");
  const root = parts.shift();
  let value: unknown;
  if (root === "input") value = scope.input;
  else if (root === "state") value = scope.state;
  else if (root === "local") value = scope.local || {};
  else throw new ExpressionEvaluationError("unknown_ref_root", `Unknown reference root: ${root}`);
  for (const part of parts) {
    if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, part)) {
      throw new ExpressionEvaluationError("unknown_ref", `Unknown reference path: ${path}`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function equal(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export function evaluateExpression(expression: Expression, scope: EvaluationScope): unknown {
  if (expression.op === "literal") return structuredClone(expression.value);
  if (expression.op === "ref") return structuredClone(resolvePath(scope, expression.path));
  if (expression.op === "get") {
    const target = evaluateExpression(expression.target, scope);
    if (!target || typeof target !== "object" || !Object.prototype.hasOwnProperty.call(target, expression.key)) {
      throw new ExpressionEvaluationError("invalid_get", `Missing key ${expression.key}`);
    }
    return structuredClone((target as Record<string, unknown>)[expression.key]);
  }
  if (expression.op === "not") return !Boolean(evaluateExpression(expression.value, scope));
  if (expression.op === "coalesce") {
    for (const item of expression.values) {
      const value = evaluateExpression(item, scope);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }
  const left = evaluateExpression(expression.left, scope);
  const right = evaluateExpression(expression.right, scope);
  if (expression.op === "eq") return equal(left, right);
  if (expression.op === "ne") return !equal(left, right);
  if (expression.op === "lt") return (left as number | string) < (right as number | string);
  if (expression.op === "lte") return (left as number | string) <= (right as number | string);
  if (expression.op === "gt") return (left as number | string) > (right as number | string);
  if (expression.op === "gte") return (left as number | string) >= (right as number | string);
  if (expression.op === "and") return Boolean(left) && Boolean(right);
  if (expression.op === "or") return Boolean(left) || Boolean(right);
  if (expression.op === "in") {
    if (Array.isArray(right)) return right.some((item) => equal(item, left));
    if (right && typeof right === "object" && typeof left === "string") {
      return Object.prototype.hasOwnProperty.call(right, left);
    }
    return false;
  }
  throw new ExpressionEvaluationError("unknown_expression", `Unsupported expression ${(expression as Expression).op}`);
}

export function evaluateMap(expressions: Record<string, Expression> | undefined, scope: EvaluationScope): Record<string, unknown> {
  return Object.fromEntries(Object.entries(expressions || {}).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, expression]) => [key, evaluateExpression(expression, scope)]));
}
