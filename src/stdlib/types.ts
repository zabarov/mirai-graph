import type { RelationFact } from "../components/types.js";

export const GRAPH_OPERATIONS_VERSION = "1.0.0" as const;
export type MetadataValue = string | number | boolean | Array<string | number | boolean>;

export interface GraphSourceRef {
  id: string;
  owner_ref: string;
  digest: string;
  confidentiality: "public" | "internal" | "restricted";
}

export interface GraphEntity {
  id: string;
  kind: string;
  scope: string;
  metadata: Record<string, MetadataValue>;
  source_refs: string[];
}

export interface GraphSnapshotInput {
  contract_version: typeof GRAPH_OPERATIONS_VERSION;
  id: string;
  objects: GraphEntity[];
  relations: RelationFact[];
  sources: GraphSourceRef[];
  canonical_write_allowed: false;
}

export interface GraphSnapshot extends GraphSnapshotInput { digest: string }

export interface GraphQuery {
  ids?: string[];
  kinds?: string[];
  scopes?: string[];
  metadata?: Record<string, string | number | boolean>;
  max_objects?: number;
}

export interface TraversalQuery {
  seeds: string[];
  relation_types: string[];
  direction: "outgoing" | "incoming" | "both";
  from_role?: string;
  to_role?: string;
  scope: string;
  now: string;
  values?: Record<string, string | number | boolean>;
  max_depth: number;
  max_objects: number;
  max_relations: number;
  max_visits?: number;
}

export interface GraphView {
  contract_version: typeof GRAPH_OPERATIONS_VERSION;
  base_digest: string;
  object_ids: string[];
  graph: GraphSnapshot;
  canonical_write_allowed: false;
  digest: string;
}

export interface GraphPatch {
  upsert_objects: GraphEntity[];
  deprecate_objects: string[];
  upsert_relations: RelationFact[];
  deprecate_relations: string[];
}

export interface GraphPatchProposal {
  contract_version: typeof GRAPH_OPERATIONS_VERSION;
  base_digest: string;
  changes: GraphPatch;
  preview: GraphSnapshot;
  status: "proposed";
  canonical_write_allowed: false;
  digest: string;
}

/** Supplied by the host after authorization, never derived from graph content. */
export interface GraphAccessSelection {
  object_ids: ReadonlySet<string>;
  source_ids: ReadonlySet<string>;
}
