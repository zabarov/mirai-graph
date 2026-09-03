import type { TaskEffect } from "../runtime/contracts.js";

export const TASK_OPERATIONS: Record<string, { effect: TaskEffect; required: string[] }> = {
  submit: { effect: "task_control", required: [] },
  dispatch: { effect: "task_dispatch", required: ["task_id"] },
  inference: { effect: "inference_invoke", required: ["task_id"] },
  inspect: { effect: "task_read", required: [] },
  collect: { effect: "task_read", required: [] },
  accept: { effect: "task_control", required: ["task_id", "reviewer", "result_digest", "verdict"] },
  cancel: { effect: "task_control", required: [] },
  reconcile: { effect: "task_control", required: ["task_id"] }
};

export function taskArgumentValid(name: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (name.endsWith("_digest")) return /^sha256:[a-f0-9]{64}$/.test(value);
  if (name === "verdict") return value === "accepted" || value === "rejected";
  return /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/.test(value);
}

export function validateTaskArguments(operation: string, args: Record<string, unknown>): void {
  if (!Object.hasOwn(TASK_OPERATIONS, operation)) throw new Error("task_operation_unknown");
  const fields = ["registry_digest", "plan_digest", ...TASK_OPERATIONS[operation]!.required];
  if (Object.keys(args).length !== fields.length || !fields.every(k => Object.hasOwn(args, k) && taskArgumentValid(k, args[k]))) throw new Error("task_operation_arguments_invalid");
}
