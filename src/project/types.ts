export type ProjectKind = "project" | "organization" | "ai_system" | "research_program" | "software_system";

export interface MiraiProjectManifest {
  contract_version: "1.0.0";
  project: {
    id: string;
    title: string;
    kind: ProjectKind;
    scope: string;
    owner: string;
  };
  requires: {
    mirai: string;
    graph_contract: string;
    program_contract: string;
    runtime_contract: string;
  };
  profiles: string[];
  entrypoints: {
    graph: { root: string; objects: string[]; relations: string[] };
    programs?: string;
    components?: string;
    policies?: string;
    interfaces?: string;
    context?: string;
    sources: string;
  };
  features: string[];
  boundaries: {
    source_of_truth: "hybrid_sot";
    canonical_writes: "owner_approval_required";
    generated_authority: false;
    evidence_authority: false;
  };
  documentation: { start: string; owner_notes: string };
  compatibility: { legacy_facade: "required_2_x" | "disabled" };
}

export interface MiraiProjectLock {
  contract_version: "1.0.0";
  manifest: MiraiProjectManifest;
  resolved_contracts: MiraiProjectManifest["requires"];
  entrypoint_digests: Record<string, string>;
  source_reference_digest: string;
  canonical_write_allowed: false;
  digest: string;
}

export type ProjectDetectionStatus =
  | "current"
  | "needs_compile"
  | "legacy_detected"
  | "dual_root_conflict"
  | "bootstrap_proposal"
  | "invalid";

export interface ProjectDetectionResult {
  contract_version: "1.0.0";
  target_dir: string;
  status: ProjectDetectionStatus;
  project_id: string | null;
  lock_fresh: boolean;
  legacy_layout: boolean;
  blockers: string[];
  canonical_write_allowed: false;
  next_safe_action: string;
}

export interface AgentExecutionBrief {
  contract_version: "1.0.0";
  project: MiraiProjectManifest["project"];
  task: string;
  versions: MiraiProjectManifest["requires"];
  lock: { digest: string; fresh: true };
  profiles: string[];
  features: string[];
  required_sources: string[];
  available_programs: string[];
  policies_and_gates: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  missing_context: string[];
  blockers: string[];
  next_safe_action: string;
  canonical_write_allowed: false;
  digest: string;
}

export interface ProjectMigrationResult {
  contract_version: "1.0.0";
  project_root: string;
  mode: "dry_run" | "apply" | "rollback";
  status: "ready" | "applied" | "rolled_back" | "blocked" | "already_current";
  source_layout: "graph_v2";
  target_layout: "mirai_project_capsule";
  inventory: Array<{ path: string; digest: string }>;
  path_map: Array<{ from: string; to: string }>;
  conflicts: string[];
  rollback_plan: string[];
  approval_ref: string | null;
  canonical_write_allowed: boolean;
  digest: string;
}
