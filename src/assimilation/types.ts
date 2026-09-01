export const SOURCE_CATALOG_CONTRACT_VERSION = "1.0.0" as const;
export const ASSIMILATION_PROPOSAL_CONTRACT_VERSION = "1.0.0" as const;

export type SourceKind = "text" | "markdown" | "json" | "yaml" | "csv" | "git_commit" | "git_diff";

export interface SourceCatalogItem {
  id: string;
  path: string;
  kind: SourceKind;
  media_type: string;
  bytes: number;
  fingerprint: string;
  provenance: {
    provider: "filesystem" | "git";
    repository_ref?: string;
    revision?: string;
  };
  parser: { provider: string; version: string };
  extracted_candidates: Array<{
    local_ref: string;
    kind: "object" | "relation";
    semantic_type: string;
    label: string;
    confidence: number;
  }>;
}

export interface SourceDiagnostic {
  code: string;
  path?: string;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface SourceCatalog {
  contract_version: typeof SOURCE_CATALOG_CONTRACT_VERSION;
  root: string;
  items: SourceCatalogItem[];
  diagnostics: SourceDiagnostic[];
  policies: {
    max_file_bytes: number;
    follow_symlinks: false;
    include_secrets: false;
    supported_extensions: string[];
  };
  canonical_write_allowed: false;
  digest: string;
}

export interface CandidateAssertion {
  id: string;
  kind: "object" | "relation";
  semantic_type: string;
  label: string;
  source_ref: string;
  confidence: number;
  provenance: { source_id: string; source_fingerprint: string };
}

export interface AssimilationProposal {
  contract_version: typeof ASSIMILATION_PROPOSAL_CONTRACT_VERSION;
  source_catalog_digest: string;
  candidate_assertions: CandidateAssertion[];
  exact_duplicates: Array<{ fingerprint: string; source_refs: string[] }>;
  conflicts: Array<{ identity_key: string; source_refs: string[]; resolution: "owner_review_required" }>;
  quality: {
    provenance_coverage: number;
    blocking_diagnostic_count: number;
    readiness: "ready_for_review" | "blocked";
  };
  diagnostics: SourceDiagnostic[];
  canonical_write_allowed: false;
  next_safe_action: "owner_review" | "resolve_blocking_diagnostics";
  digest: string;
}
