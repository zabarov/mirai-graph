export const SOURCE_PROVIDER_CONTRACT_VERSION = "1.0.0" as const;
export const SOURCE_SNAPSHOT_CONTRACT_VERSION = "1.0.0" as const;
export const NORMALIZED_UNIT_CONTRACT_VERSION = "1.0.0" as const;

export type SourceProviderKind = "filesystem" | "git" | "http" | "postgres" | "mysql" | "s3" | "mcp" | "custom";
export type SourceProviderOperation = "discover" | "read" | "query" | "observe" | "snapshot";
export type SourceAuthority = "informational" | "supporting" | "owner_asserted" | "canonical_external";
export type Confidentiality = "public" | "internal" | "confidential" | "restricted";

export interface SourceDescriptor {
  contract_version: typeof SOURCE_PROVIDER_CONTRACT_VERSION;
  id: string;
  provider: SourceProviderKind;
  locator: string;
  connection_ref?: string;
  authority: SourceAuthority;
  scope: string;
  confidentiality: Confidentiality;
  freshness: { max_age_ms?: number; valid_until?: string };
  read_only: true;
  configuration: Record<string, unknown>;
}

export interface SourceBudget {
  max_items: number;
  max_item_bytes: number;
  max_total_bytes: number;
  timeout_ms: number;
}

export interface SourcePayload {
  key: string;
  media_type: string;
  content: Uint8Array;
  modified_at?: string;
  etag?: string;
  version?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SourceProvider {
  readonly id: string;
  readonly kind: SourceProviderKind;
  readonly read_only: true;
  readonly operations: readonly SourceProviderOperation[];
  scan(descriptor: SourceDescriptor, budget: SourceBudget): Promise<SourcePayload[]>;
}

export interface SourceSnapshotItem {
  source_id: string;
  key: string;
  media_type: string;
  bytes: number;
  fingerprint: string;
  modified_at?: string;
  etag?: string;
  version?: string;
  authority: SourceAuthority;
  scope: string;
  confidentiality: Confidentiality;
  provenance: { provider: SourceProviderKind; locator_digest: string; connection_ref?: string };
}

export interface SourceSnapshot {
  contract_version: typeof SOURCE_SNAPSHOT_CONTRACT_VERSION;
  source: Omit<SourceDescriptor, "configuration"> & { configuration_digest: string };
  items: SourceSnapshotItem[];
  changes: Array<{ key: string; state: "added" | "changed" | "unchanged" | "source_missing"; previous_fingerprint?: string; current_fingerprint?: string }>;
  budgets: SourceBudget;
  canonical_write_allowed: false;
  digest: string;
}

export type NormalizedUnitKind = "text" | "record" | "table" | "document_fragment";

export interface NormalizedUnit {
  contract_version: typeof NORMALIZED_UNIT_CONTRACT_VERSION;
  id: string;
  source_ref: string;
  source_fingerprint: string;
  kind: NormalizedUnitKind;
  media_type: string;
  ordinal: number;
  content: string | Record<string, unknown> | unknown[];
  content_digest: string;
  source_span?: { page?: number; sheet?: string; row?: number; section?: string };
  authority: SourceAuthority;
  scope: string;
  confidentiality: Confidentiality;
  instructions_authorized: false;
}

export interface ContentConverter {
  readonly id: string;
  readonly version: string;
  supports(mediaType: string, key: string): boolean;
  convert(payload: SourcePayload, snapshotItem: SourceSnapshotItem, budget: SourceBudget): Promise<NormalizedUnit[]>;
}

export interface ConversionDiagnostic {
  source_ref: string;
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  converter_proposal_required: boolean;
}

export interface ConversionResult {
  units: NormalizedUnit[];
  diagnostics: ConversionDiagnostic[];
  raw_source_persisted: false;
  canonical_write_allowed: false;
}

export interface DataPlacementPolicy {
  contract_version: "1.0.0";
  id: string;
  source_scope: string;
  placement: "external_sot" | "canonical_reference" | "adaptive_metadata" | "host_cache" | "runtime_state" | "evidence";
  retention: "source_owned" | "versioned" | "bounded" | "ephemeral";
  contains_bulk_content: boolean;
  contains_secrets: false;
  canonical_write_allowed: false;
}

export const DEFAULT_SOURCE_BUDGET: SourceBudget = {
  max_items: 10_000,
  max_item_bytes: 8 * 1024 * 1024,
  max_total_bytes: 128 * 1024 * 1024,
  timeout_ms: 30_000
};
