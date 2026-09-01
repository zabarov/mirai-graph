export const RUNTIME_API_VERSION = "1.0.0" as const;

export interface RuntimeAvailability {
  api_version: typeof RUNTIME_API_VERSION;
  status: "not_available_in_alpha_1";
  executable_effects_enabled: false;
}

export function runtimeAvailability(): RuntimeAvailability {
  return {
    api_version: RUNTIME_API_VERSION,
    status: "not_available_in_alpha_1",
    executable_effects_enabled: false
  };
}
