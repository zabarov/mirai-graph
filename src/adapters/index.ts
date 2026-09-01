export const ADAPTER_API_VERSION = "1.0.0" as const;

export interface AdapterDescriptor {
  id: string;
  operations: string[];
  effects: string[];
}

export interface AdapterCatalog {
  api_version: typeof ADAPTER_API_VERSION;
  adapters: AdapterDescriptor[];
  execution_enabled: false;
}

export function alpha1AdapterCatalog(): AdapterCatalog {
  return {
    api_version: ADAPTER_API_VERSION,
    adapters: [],
    execution_enabled: false
  };
}
