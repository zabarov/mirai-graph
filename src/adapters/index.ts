export const ADAPTER_API_VERSION = "1.0.0" as const;

export interface AdapterDescriptor {
  id: string;
  operations: string[];
  effects: string[];
}

export interface AdapterCatalog {
  api_version: typeof ADAPTER_API_VERSION;
  adapters: AdapterDescriptor[];
  execution_enabled: boolean;
}

export function referenceAdapterCatalog(): AdapterCatalog {
  return {
    api_version: ADAPTER_API_VERSION,
    adapters: [
      { id: "repository", operations: ["read_file", "list_files"], effects: ["repository_read"] },
      { id: "git", operations: ["status", "diff"], effects: ["git_read"] },
      { id: "workspace", operations: ["write_file"], effects: ["workspace_patch"] },
      { id: "test", operations: ["run"], effects: ["process_run"] },
      { id: "human", operations: ["approval"], effects: ["human_approval"] }
    ],
    execution_enabled: true
  };
}

export const alpha1AdapterCatalog = referenceAdapterCatalog;

export * from "./types.js";
export * from "./reference.js";
