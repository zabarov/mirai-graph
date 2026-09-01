export interface PureAdapterContext {
  program_id: string;
  node_id: string;
  attempt: number;
}

export type PureAdapterOperation = (args: Record<string, unknown>, context: PureAdapterContext) => unknown | Promise<unknown>;

export type PureAdapterRegistry = Record<string, Record<string, PureAdapterOperation>>;

function requireInt64(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`pure_adapter_invalid_int64:${name}`);
  return value as number;
}

export const DEFAULT_PURE_ADAPTERS: PureAdapterRegistry = {
  pure: {
    identity(args) {
      return Object.prototype.hasOwnProperty.call(args, "value") ? structuredClone(args.value) : structuredClone(args);
    },
    add_int64(args) {
      return requireInt64(args.left, "left") + requireInt64(args.right, "right");
    },
    concat(args) {
      const values = Array.isArray(args.values) ? args.values : [args.left, args.right];
      if (values.some((value) => typeof value !== "string")) throw new Error("pure_adapter_invalid_string");
      return values.join(typeof args.separator === "string" ? args.separator : "");
    },
    length(args) {
      const value = args.value;
      if (typeof value === "string" || Array.isArray(value)) return value.length;
      if (value && typeof value === "object") return Object.keys(value).length;
      throw new Error("pure_adapter_length_unsupported");
    },
    fail(args) {
      throw new Error(typeof args.code === "string" ? args.code : "pure_adapter_requested_failure");
    }
  }
};
