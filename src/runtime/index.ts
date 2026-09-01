export const RUNTIME_API_VERSION = "1.0.0" as const;

export interface RuntimeAvailability {
  api_version: typeof RUNTIME_API_VERSION;
  status: "pure_interpreter_available";
  executable_effects_enabled: false;
}

export function runtimeAvailability(): RuntimeAvailability {
  return {
    api_version: RUNTIME_API_VERSION,
    status: "pure_interpreter_available",
    executable_effects_enabled: false
  };
}

export * from "./expression.js";
export * from "./pure-adapters.js";
export * from "./pure-interpreter.js";
export * from "./replay.js";
