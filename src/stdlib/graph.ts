import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalJson, digestValue } from "../core/canonical.js";
import { relationApplies, validateRelationFact } from "../components/validator.js";
import { GRAPH_SNAPSHOT_SCHEMA } from "./schema.js";
import type { GraphAccessSelection, GraphPatch, GraphPatchProposal, GraphQuery, GraphSnapshot, GraphSnapshotInput, GraphView, TraversalQuery } from "./types.js";

const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
const shape = ajv.compile<GraphSnapshot>(GRAPH_SNAPSHOT_SCHEMA);
const MAX_BYTES = 8 * 1024 * 1024;
export const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function requireSafeString(value: string): void {
  requireCondition(value.length <= 4096, "graph_string_budget_exceeded");
  requireCondition(!/(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\b(?:ghp_|sk-proj-|xoxb-)[A-Za-z0-9_-]{8,}|\/Users\/|[A-Za-z]:\\Users\\)/.test(value), "sensitive_content_rejected");
}

export function requireJson(value: unknown): void {
  let nodes = 0;
  const active = new Set<object>();
  function visit(item: unknown, depth: number): void {
    requireCondition(depth <= 16 && ++nodes <= 1000000, "graph_structure_budget_exceeded");
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "number") { requireCondition(Number.isFinite(item), "non_finite_value"); return; }
    if (typeof item === "string") {
      requireSafeString(item);
      return;
    }
    requireCondition(item && typeof item === "object" && (Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null), "non_json_value");
    requireCondition(!active.has(item), "cyclic_json_value");
    active.add(item);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
      if (Array.isArray(item) && key === "length") continue;
      requireCondition(!["__proto__", "constructor", "prototype"].includes(key) && "value" in descriptor, "unsafe_json_property");
      requireSafeString(key);
      visit(descriptor.value, depth + 1);
    }
    active.delete(item);
  }
  visit(value, 0);
  requireCondition(Buffer.byteLength(JSON.stringify(value)) <= MAX_BYTES, "graph_byte_budget_exceeded");
}

export function seal<T extends object>(value: T): T & { digest: string } {
  return { ...value, digest: digestValue(value) };
}

function unique(values: string[], code: string): void {
  requireCondition(new Set(values).size === values.length, code);
}

export function assertSnapshot(value: unknown): asserts value is GraphSnapshot {
  requireJson(value);
  requireCondition(shape(value), "graph_snapshot_shape_invalid");
  const graph = value;
  unique(graph.objects.map(x => x.id), "duplicate_object_id");
  unique(graph.relations.map(x => x.id), "duplicate_relation_id");
  unique(graph.sources.map(x => x.id), "duplicate_source_id");
  const objects = new Set(graph.objects.map(x => x.id));
  const sources = new Set(graph.sources.map(x => x.id));
  for (const object of graph.objects) {
    requireCondition(object.source_refs.every(id => sources.has(id)), "object_source_missing");
  }
  for (const relation of graph.relations) {
    requireCondition(validateRelationFact(relation).valid, "relation_fact_invalid");
    requireCondition(relation.participants.every(p => objects.has(p.ref)), "relation_participant_missing");
    requireCondition(relation.provenance.every(p => sources.has(p.source_ref) && (!p.evidence_ref || sources.has(p.evidence_ref))), "relation_source_missing");
  }
  const { digest, ...body } = graph;
  requireCondition(digestValue(body) === digest, "graph_snapshot_digest_mismatch");
}

export function createGraphSnapshot(input: GraphSnapshotInput): GraphSnapshot {
  requireJson(input);
  const graph = seal(structuredClone(input));
  assertSnapshot(graph);
  graph.objects.sort((a, b) => lexical(a.id, b.id));
  for (const object of graph.objects) {
    object.source_refs.sort(lexical);
    for (const value of Object.values(object.metadata)) if (Array.isArray(value)) value.sort((a, b) => lexical(canonicalJson(a), canonicalJson(b)));
  }
  graph.relations.sort((a, b) => lexical(a.id, b.id));
  for (const relation of graph.relations) {
    relation.participants.sort((a, b) => lexical(a.role, b.role));
    relation.provenance.sort((a, b) => lexical(canonicalJson(a), canonicalJson(b)));
  }
  graph.sources.sort((a, b) => lexical(a.id, b.id));
  const { digest: _digest, ...body } = graph;
  return seal(body);
}

function subset(graph: GraphSnapshot, ids: Set<string>, permittedSources?: ReadonlySet<string>): GraphSnapshot {
  const objects = graph.objects.filter(x => ids.has(x.id));
  const relations = graph.relations.filter(r => r.participants.every(p => ids.has(p.ref)) &&
    (!permittedSources || r.provenance.every(p => permittedSources.has(p.source_ref) && (!p.evidence_ref || permittedSources.has(p.evidence_ref)))));
  const refs = new Set(objects.flatMap(o => o.source_refs));
  for (const r of relations) for (const p of r.provenance) {
    refs.add(p.source_ref);
    if (p.evidence_ref) refs.add(p.evidence_ref);
  }
  return createGraphSnapshot({ contract_version: "1.0.0", id: graph.id, objects, relations,
    sources: graph.sources.filter(s => refs.has(s.id)), canonical_write_allowed: false });
}

/** A selection is not a grant. The trusted host must authenticate it first. */
export function projectAccessibleSnapshot(graph: GraphSnapshot, access: GraphAccessSelection): GraphSnapshot {
  assertSnapshot(graph);
  return subset(graph, new Set(graph.objects.filter(o => access.object_ids.has(o.id) &&
    o.source_refs.every(id => access.source_ids.has(id))).map(o => o.id)), access.source_ids);
}

export function projectGraph(graph: GraphSnapshot, objectIds: string[]): GraphView {
  assertSnapshot(graph);
  requireJson(objectIds);
  requireCondition(Array.isArray(objectIds) && objectIds.every(id => typeof id === "string"), "invalid_object_selection");
  unique(objectIds, "duplicate_object_selection");
  const known = new Set(graph.objects.map(x => x.id));
  requireCondition(objectIds.every(id => known.has(id)), "unknown_object_selection");
  const ids = [...objectIds].sort(lexical);
  return seal({ contract_version: "1.0.0" as const, base_digest: graph.digest, object_ids: ids,
    graph: subset(graph, new Set(ids)), canonical_write_allowed: false as const });
}

export function queryGraph(graph: GraphSnapshot, query: GraphQuery): GraphView {
  assertSnapshot(graph);
  requireJson(query);
  requireCondition(query && typeof query === "object" && !Array.isArray(query), "invalid_graph_query");
  requireCondition(Object.keys(query).every(k => ["ids", "kinds", "scopes", "metadata", "max_objects"].includes(k)), "unknown_query_field");
  for (const list of [query.ids, query.kinds, query.scopes]) requireCondition(list === undefined || (Array.isArray(list) && list.every(x => typeof x === "string")), "invalid_query_filter");
  requireCondition(query.metadata === undefined || (query.metadata !== null && !Array.isArray(query.metadata) && typeof query.metadata === "object" && Object.values(query.metadata).every(x => ["string", "boolean", "number"].includes(typeof x))), "invalid_metadata_filter");
  const limit = query.max_objects ?? 1000;
  requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 10000, "invalid_query_budget");
  if (query.ids) {
    const known = new Set(graph.objects.map(o => o.id));
    requireCondition(query.ids.every(id => known.has(id)), "unknown_query_object");
  }
  const selected = graph.objects.filter(o => (!query.ids || query.ids.includes(o.id)) &&
    (!query.kinds || query.kinds.includes(o.kind)) && (!query.scopes || query.scopes.includes(o.scope)) &&
    Object.entries(query.metadata || {}).every(([k, v]) => Array.isArray(o.metadata[k]) ? (o.metadata[k] as unknown[]).includes(v) : o.metadata[k] === v));
  requireCondition(selected.length <= limit, "query_object_budget_exceeded");
  return projectGraph(graph, selected.map(o => o.id));
}

export function traverseGraph(graph: GraphSnapshot, query: TraversalQuery): GraphView {
  assertSnapshot(graph);
  requireJson(query);
  requireCondition(query && Object.keys(query).every(k => ["seeds", "relation_types", "direction", "from_role", "to_role", "scope", "now", "values", "max_depth", "max_objects", "max_relations", "max_visits"].includes(k)), "invalid_traversal_field");
  requireCondition(Array.isArray(query.seeds) && query.seeds.length > 0 && Array.isArray(query.relation_types) && query.relation_types.length > 0, "traversal_seeds_and_types_required");
  requireCondition(["outgoing", "incoming", "both"].includes(query.direction), "invalid_traversal_direction");
  requireCondition(typeof query.scope === "string" && typeof query.now === "string" && Number.isFinite(Date.parse(query.now)), "invalid_traversal_context");
  if (query.direction !== "both") requireCondition(typeof query.from_role === "string" && typeof query.to_role === "string" && query.from_role !== query.to_role, "traversal_roles_required");
  for (const [value, maximum] of [[query.max_depth, 64], [query.max_objects, 10000], [query.max_relations, 40000]]) {
    requireCondition(Number.isSafeInteger(value) && value! > 0 && value! <= maximum!, "invalid_traversal_budget");
  }
  projectGraph(graph, query.seeds);
  const maxVisits = query.max_visits ?? 100000;
  requireCondition(Number.isSafeInteger(maxVisits) && maxVisits > 0 && maxVisits <= 1000000, "invalid_traversal_budget");
  let visits = 0;
  const selected = new Set(query.seeds);
  const traversed = new Set<string>();
  const applicable = graph.relations.filter(r => query.relation_types.includes(r.type) && relationApplies(r, query));
  let frontier = [...selected];
  for (let depth = 0; frontier.length; depth++) {
    const next = new Set<string>();
    const current = new Set(frontier);
    for (const relation of applicable) {
      visits += relation.participants.length;
      requireCondition(visits <= maxVisits, "traversal_work_budget_exceeded");
      const fromRole = query.direction === "incoming" ? query.to_role : query.from_role;
      const toRole = query.direction === "incoming" ? query.from_role : query.to_role;
      if (!relation.participants.some(p => current.has(p.ref) && (query.direction === "both" || p.role === fromRole))) continue;
      const targets = relation.participants.filter(p => query.direction === "both" || p.role === toRole).map(p => p.ref);
      if (!targets.length) continue;
      traversed.add(relation.id);
      for (const ref of targets) if (!selected.has(ref)) next.add(ref);
    }
    requireCondition(traversed.size <= query.max_relations, "traversal_relation_budget_exceeded");
    requireCondition(selected.size + next.size <= query.max_objects, "traversal_object_budget_exceeded");
    requireCondition(next.size === 0 || depth < query.max_depth, "traversal_depth_budget_exceeded");
    for (const id of next) selected.add(id);
    frontier = [...next].sort(lexical);
  }
  const { digest: _digest, ...body } = graph;
  const filtered = createGraphSnapshot({ ...body, relations: applicable.filter(r => traversed.has(r.id)) });
  const view = projectGraph(filtered, [...selected]);
  const { digest: _viewDigest, ...viewBody } = view;
  return seal({ ...viewBody, base_digest: graph.digest });
}

export function diffGraphs(before: GraphSnapshot, after: GraphSnapshot) {
  assertSnapshot(before); assertSnapshot(after);
  requireCondition(before.id === after.id, "graph_identity_mismatch");
  function diff(a: Array<{ id: string }>, b: Array<{ id: string }>) {
    const old = new Map(a.map(x => [x.id, canonicalJson(x)]));
    const next = new Map(b.map(x => [x.id, canonicalJson(x)]));
    return { added: [...next.keys()].filter(id => !old.has(id)).sort(lexical),
      changed: [...next.keys()].filter(id => old.has(id) && old.get(id) !== next.get(id)).sort(lexical),
      removed: [...old.keys()].filter(id => !next.has(id)).sort(lexical) };
  }
  return seal({ contract_version: "1.0.0", before_digest: before.digest, after_digest: after.digest,
    objects: diff(before.objects, after.objects), relations: diff(before.relations, after.relations), sources: diff(before.sources, after.sources), canonical_write_allowed: false });
}

export function proposeGraphPatch(graph: GraphSnapshot, patch: GraphPatch): GraphPatchProposal {
  assertSnapshot(graph); requireJson(patch);
  requireCondition(patch && Object.keys(patch).sort().join(",") === "deprecate_objects,deprecate_relations,upsert_objects,upsert_relations", "graph_patch_shape_invalid");
  for (const values of Object.values(patch)) requireCondition(Array.isArray(values), "graph_patch_shape_invalid");
  for (const ids of [patch.upsert_objects.map(o => o.id), patch.upsert_relations.map(r => r.id), patch.deprecate_objects, patch.deprecate_relations]) unique(ids, "duplicate_patch_target");
  for (const relation of patch.upsert_relations) {
    requireCondition(relation.authority === "proposal" && !relation.activation_rule, "relation_requires_owner_review");
  }
  const oldObjects = new Map(graph.objects.map(o => [o.id, o]));
  for (const object of patch.upsert_objects) {
    requireCondition(!/policy|authority|capability|approval|constitution|owner/i.test(object.kind), "protected_object_patch_forbidden");
    const old = oldObjects.get(object.id);
    if (old) requireCondition(old.kind === object.kind && old.scope === object.scope && canonicalJson([...old.source_refs].sort()) === canonicalJson([...object.source_refs].sort()), "object_boundary_change_forbidden");
  }
  for (const relation of [...graph.relations.filter(r => patch.deprecate_relations.includes(r.id)), ...patch.upsert_relations]) {
    requireCondition(!/govern|authoriz|permit|approval|capability|owner|delegat/i.test(relation.type), "authority_relation_patch_forbidden");
  }
  for (const id of patch.deprecate_objects) {
    const old = oldObjects.get(id);
    requireCondition(old && !/policy|authority|capability|approval|constitution|owner/i.test(old.kind), "protected_or_missing_object");
  }
  function merge<T extends { id: string }>(original: T[], upserts: T[], removals: string[]): T[] {
    const result = new Map(original.map(x => [x.id, x]));
    requireCondition(removals.every(id => result.has(id)), "unknown_deprecation_target");
    requireCondition(upserts.every(x => !removals.includes(x.id)), "conflicting_patch_target");
    for (const id of removals) result.delete(id);
    for (const item of upserts) result.set(item.id, item);
    return [...result.values()];
  }
  const { digest: _digest, ...body } = graph;
  const preview = createGraphSnapshot({ ...body,
    objects: merge(graph.objects, patch.upsert_objects, patch.deprecate_objects),
    relations: merge(graph.relations, patch.upsert_relations, patch.deprecate_relations) });
  const changes = structuredClone(patch);
  changes.upsert_objects.sort((a, b) => lexical(a.id, b.id)); changes.upsert_relations.sort((a, b) => lexical(a.id, b.id));
  changes.deprecate_objects.sort(lexical); changes.deprecate_relations.sort(lexical);
  return seal({ contract_version: "1.0.0" as const, base_digest: graph.digest, changes, preview,
    status: "proposed" as const, canonical_write_allowed: false as const });
}
