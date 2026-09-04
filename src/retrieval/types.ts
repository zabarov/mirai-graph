import type { GraphSnapshot } from "../stdlib/types.js";
import type { NormalizedUnit, SourceAuthority } from "../sources/types.js";

export const RETRIEVAL_CONTRACT_VERSION = "1.0.0" as const;

export type RetrievalIntent = "exact_lookup" | "semantic_discovery" | "relationship_trace" | "technology_lookup" | "policy_lookup" | "evidence_lookup" | "change_or_freshness" | "global_synthesis";
export type RetrievalChannel = "exact" | "lexical" | "semantic" | "graph" | "process";
export type RetrievalFreshness = "current" | "aging" | "stale" | "unknown";
export type RetrievalConfidentiality = "public" | "internal" | "confidential" | "restricted";

export interface RetrievalAccessSelection {
  principal_id: string;
  purpose: string;
  scopes: string[];
  source_refs: string[];
  document_ids?: string[];
  policy_digest: string;
}

export interface RetrievalInputConfig {
  kind: "normalized_units" | "graph_snapshot" | "programs" | "policies" | "evidence";
  path: string;
  snapshot_digest?: string;
}

export interface RetrievalProjectConfig {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  index_id: string;
  project_id: string;
  inputs: RetrievalInputConfig[];
  access: RetrievalAccessSelection;
  placement: { mode: "minimal_projection"; confidential_mode: "reference_only"; max_snippet_chars: number };
  semantic: { provider: "disabled" | "local" | "external"; model?: string; dimensions?: number };
  budgets: { max_documents: number; max_index_bytes: number; max_query_results: number; max_graph_depth: number; max_fan_out: number; max_hops: number; timeout_ms: number };
}

export interface RetrievalDocument {
  id: string;
  kind: string;
  title: string;
  search_text: string;
  snippet: string;
  source_ref: string;
  source_digest: string;
  scope: string;
  authority: SourceAuthority | "canonical" | "derived" | "proposal";
  freshness: RetrievalFreshness;
  confidentiality: RetrievalConfidentiality;
  graph_object_refs: string[];
  evidence_refs: string[];
  program_refs: string[];
  policy_refs: string[];
  conflict_refs?: string[];
  embedding?: number[];
  digest: string;
}

export interface RetrievalIndexDescriptor {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  index_id: string;
  project_id: string;
  provider: "orama";
  provider_version: string;
  access_digest: string;
  configuration_digest: string;
  source_snapshot_digests: string[];
  graph_snapshot_digest: string | null;
  source_projection_digest: string;
  documents_digest: string;
  storage_digest: string;
  document_count: number;
  semantic_status: "ready" | "disabled" | "provider_unavailable";
  semantic_model: string | null;
  semantic_revision: string | null;
  semantic_files_digest: string | null;
  dimensions: number | null;
  built_at: string;
  canonical_write_allowed: false;
  digest: string;
}

export interface RetrievalRequest {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  id: string;
  query: string;
  intent?: RetrievalIntent;
  access: RetrievalAccessSelection;
  freshness_required?: "current" | "allow_aging" | "allow_stale";
  channels?: RetrievalChannel[];
  max_results?: number;
  graph?: GraphSnapshot;
  canonical_write_allowed: false;
}

export interface RetrievalPlan {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  request_digest: string;
  intent: RetrievalIntent;
  channels: RetrievalChannel[];
  filters: { scopes: string[]; source_refs: string[]; freshness_required: "current" | "allow_aging" | "allow_stale" };
  budgets: { max_results: number; max_graph_depth: number; timeout_ms: number };
  semantic_status: RetrievalIndexDescriptor["semantic_status"];
  diagnostics: string[];
  canonical_write_allowed: false;
  digest: string;
}

export interface RetrievalHit {
  document_id: string;
  kind: string;
  title: string;
  snippet: string;
  source_ref: string;
  scope: string;
  authority: RetrievalDocument["authority"];
  freshness: RetrievalFreshness;
  graph_object_refs: string[];
  evidence_refs: string[];
  program_refs: string[];
  policy_refs: string[];
  conflict_refs?: string[];
  channels: RetrievalChannel[];
  rank_score: number;
  match_reasons: string[];
  graph_path?: string[];
  instructions_authorized: false;
}

export interface EvidenceBundle {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  query_digest: string;
  index_digest: string;
  graph_digest: string | null;
  policy_digest: string;
  hits: RetrievalHit[];
  source_refs: string[];
  conflicts: string[];
  limitations: string[];
  partial: boolean;
  instructions_authorized: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface RetrievalAnswer {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  request_id: string;
  intent: RetrievalIntent;
  status: "answered" | "clarification_required" | "insufficient_evidence" | "partial";
  answer: string;
  claims: Array<{ text: string; evidence_refs: string[]; source_refs: string[] }>;
  relevant_relationships: Array<{ path: string[]; evidence_refs: string[] }>;
  program_candidates: string[];
  policy_refs: string[];
  conflicts: string[];
  limitations: string[];
  next_safe_action: string;
  execution_allowed: false;
  content_is_untrusted_data: true;
  canonical_write_allowed: false;
  evidence_bundle_digest: string;
  digest: string;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimensions: number;
  readonly revision?: string;
  readonly files_digest?: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface RetrievalProvider {
  readonly id: string;
  build(config: RetrievalProjectConfig, units: NormalizedUnit[], graph?: GraphSnapshot): Promise<RetrievalIndexDescriptor>;
  search(request: RetrievalRequest): Promise<{ plan: RetrievalPlan; evidence: EvidenceBundle; answer: RetrievalAnswer }>;
}

export interface FederatedRetrievalDirectoryEntry {
  graph_id: string;
  domains: string[];
  intents: RetrievalIntent[];
  scopes: string[];
  source_refs: string[];
  authority: SourceAuthority;
  freshness: RetrievalFreshness;
  endpoint_alias: string;
  policy_digest: string;
  index_digest?: string;
  graph_digest?: string | null;
  cache_ttl_ms?: number;
}

export interface FederatedQueryEnvelope {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  id: string;
  origin_graph_id: string;
  requester: RetrievalAccessSelection;
  query: string;
  intent: RetrievalIntent;
  target_domains: string[];
  visited_graph_ids: string[];
  max_hops: number;
  max_fan_out: number;
  deadline: string;
  token_budget: number;
  cost_budget: number;
  freshness_required: "current" | "allow_aging" | "allow_stale";
  canonical_write_allowed: false;
}

export interface FederatedQueryResult {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  query_id: string;
  responder_graph_id: string;
  query_digest: string;
  index_digest: string;
  graph_digest: string | null;
  policy_digest: string;
  evidence_bundle: EvidenceBundle;
  status: "complete" | "partial" | "blocked";
  blockers: string[];
  instructions_authorized: false;
  canonical_write_allowed: false;
  digest: string;
}

export interface RetrievalEvaluation {
  contract_version: typeof RETRIEVAL_CONTRACT_VERSION;
  corpus_id: string;
  system: "lexical" | "semantic" | "graph" | "hybrid" | "mirai_planner";
  recall_at_k: number;
  ndcg_at_k: number;
  mrr: number;
  intent_accuracy: number;
  path_correctness: number;
  evidence_coverage: number;
  claim_faithfulness: number;
  conflict_detection_rate: number;
  stale_detection_rate: number;
  unauthorized_hit_count: number;
  stale_hit_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  model_calls: number;
  input_tokens: number;
  cost_usd: number;
  limitations: string[];
  digest: string;
}
