export const RUNTIME_API_VERSION = "1.0.0" as const;

export interface RuntimeAvailability {
  api_version: typeof RUNTIME_API_VERSION;
  status: "governed_reference_runtime_available";
  executable_effects_enabled: true;
}

export function runtimeAvailability(): RuntimeAvailability {
  return {
    api_version: RUNTIME_API_VERSION,
    status: "governed_reference_runtime_available",
    executable_effects_enabled: true
  };
}

export * from "./expression.js";
export * from "./pure-adapters.js";
export * from "./pure-interpreter.js";
export * from "./replay.js";
export * from "./contracts.js";
export * from "./approval.js";
export * from "./capabilities.js";
export * from "./store.js";
export * from "./effects.js";
export * from "./governed-runtime.js";
export * from "./evidence.js";
