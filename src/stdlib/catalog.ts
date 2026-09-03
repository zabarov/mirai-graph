import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { digestValue } from "../core/canonical.js";
import { CLUSTER_POLICY_SCHEMA, CLUSTER_PROPOSAL_SCHEMA, evaluateClusters, materializeClusterView, proposeRuleClusters } from "../knowledge/clusters.js";
import { DEFAULT_PURE_ADAPTERS, type PureAdapterRegistry } from "../runtime/pure-adapters.js";
import { assertSnapshot, createGraphSnapshot, diffGraphs, projectGraph, proposeGraphPatch, queryGraph, requireCondition, requireJson, seal, traverseGraph } from "./graph.js";
import { digestSchema, entitySchema, GRAPH_SNAPSHOT_SCHEMA, referenceSchema, relationSchema, scalarSchema } from "./schema.js";
import type { GraphPatch, GraphQuery, GraphSnapshot, GraphSnapshotInput, TraversalQuery } from "./types.js";
import type { ClusterPolicy, ClusterProposal } from "../knowledge/clusters.js";
import { COMPONENT_PACKAGE_SCHEMA } from "../components/schema.js";
import type { ComponentPackage } from "../components/types.js";
import type { ActivationGraphSnapshot, ActivationSignal } from "../activation/types.js";
import { describeComponent, resolveComponentOperations } from "./components.js";

type Schema = Record<string, unknown>;
interface OperationDefinition {
  id: string;
  summary: string;
  input_schema: Schema;
  output_schema: Schema;
  execute: (args: Record<string, unknown>) => unknown;
}
const object = (properties: Record<string, unknown>, required = Object.keys(properties)): Schema => ({ type: "object", additionalProperties: false, properties, required });
const ids = { type: "array", uniqueItems: true, maxItems: 10000, items: referenceSchema };
const snapshot = { $ref: GRAPH_SNAPSHOT_SCHEMA.$id };
const proposal = { $ref: CLUSTER_PROPOSAL_SCHEMA.$id };
const readonlyOutput: Schema = { type: "object", required: ["digest", "canonical_write_allowed"],
  properties: { digest: digestSchema, canonical_write_allowed: { const: false } } };
const view = object({ contract_version: { const: "1.0.0" }, base_digest: digestSchema, object_ids: ids,
  graph: snapshot, canonical_write_allowed: { const: false }, digest: digestSchema });
const query = object({ ids, kinds: ids, scopes: ids,
  metadata: { type: "object", maxProperties: 64, propertyNames: referenceSchema, additionalProperties: scalarSchema },
  max_objects: { type: "integer", minimum: 1, maximum: 10000 } }, []);
const traversal = object({ seeds: { ...ids, minItems: 1 }, relation_types: { ...ids, minItems: 1 },
  direction: { enum: ["incoming", "outgoing", "both"] }, from_role: referenceSchema, to_role: referenceSchema,
  scope: referenceSchema, now: { type: "string", format: "date-time" },
  values: { type: "object", maxProperties: 64, propertyNames: referenceSchema, additionalProperties: scalarSchema },
  max_depth: { type: "integer", minimum: 1, maximum: 64 }, max_objects: { type: "integer", minimum: 1, maximum: 10000 },
  max_relations: { type: "integer", minimum: 1, maximum: 40000 }, max_visits: { type: "integer", minimum: 1, maximum: 1000000 }
}, ["seeds", "relation_types", "direction", "scope", "now", "max_depth", "max_objects", "max_relations"]);
const patch = object({ upsert_objects: { type: "array", maxItems: 10000, items: entitySchema }, deprecate_objects: ids,
  upsert_relations: { type: "array", maxItems: 40000, items: relationSchema }, deprecate_relations: ids });
const patchProposal = object({ contract_version: { const: "1.0.0" }, base_digest: digestSchema, changes: patch,
  preview: snapshot, status: { const: "proposed" }, canonical_write_allowed: { const: false }, digest: digestSchema });
const diffCollection = object({ added: ids, changed: ids, removed: ids });
const diffOutput = object({ contract_version: { const: "1.0.0" }, before_digest: digestSchema, after_digest: digestSchema,
  objects: diffCollection, relations: diffCollection, sources: diffCollection, canonical_write_allowed: { const: false }, digest: digestSchema });
const draftInput = { ...GRAPH_SNAPSHOT_SCHEMA, $id: undefined, required: GRAPH_SNAPSHOT_SCHEMA.required.filter(k => k !== "digest"),
  properties: Object.fromEntries(Object.entries(GRAPH_SNAPSHOT_SCHEMA.properties).filter(([key]) => key !== "digest")) };
delete draftInput.$id;

const definitions: OperationDefinition[] = [
  { id: "component.describe", summary: "Describe an existing instance and exposed operations without granting access.",
    input_schema: object({ package: { $ref: COMPONENT_PACKAGE_SCHEMA.$id }, instance_id: referenceSchema }), output_schema: readonlyOutput,
    execute: a => describeComponent(a.package as ComponentPackage, a.instance_id as string) },
  { id: "component.resolve", summary: "Reuse contextual activation resolution for explicitly selected, same-scope instances; never execute them.",
    input_schema: object({ snapshot: object({ id: referenceSchema, graph_snapshot_digest: digestSchema, policy_digest: digestSchema,
      components: { $ref: COMPONENT_PACKAGE_SCHEMA.$id }, relation_facts: { type: "array", maxItems: 40000, items: relationSchema } }),
      signal: object({ id: referenceSchema, type: referenceSchema, goal: { type: "string", maxLength: 256 }, scope: referenceSchema,
        now: { type: "string", format: "date-time" }, operation: referenceSchema, component_refs: { ...ids, minItems: 1 },
        values: { type: "object", maxProperties: 64, propertyNames: referenceSchema, additionalProperties: scalarSchema }
      }, ["id", "type", "goal", "scope", "now", "operation", "component_refs"]) }), output_schema: readonlyOutput,
    execute: a => resolveComponentOperations(a.snapshot as ActivationGraphSnapshot, a.signal as ActivationSignal) },
  { id: "graph.query", summary: "Select objects using bounded exact filters.", input_schema: object({ graph: snapshot, query }), output_schema: view,
    execute: a => queryGraph(a.graph as GraphSnapshot, a.query as GraphQuery) },
  { id: "graph.traverse", summary: "Follow explicit relation roles in time and scope.", input_schema: object({ graph: snapshot, query: traversal }), output_schema: view,
    execute: a => traverseGraph(a.graph as GraphSnapshot, a.query as TraversalQuery) },
  { id: "graph.project", summary: "Build an induced reference view; this does not authorize access.", input_schema: object({ graph: snapshot, object_ids: ids }), output_schema: view,
    execute: a => projectGraph(a.graph as GraphSnapshot, a.object_ids as string[]) },
  { id: "graph.diff", summary: "Compare snapshots without applying changes.", input_schema: object({ before: snapshot, after: snapshot }), output_schema: diffOutput,
    execute: a => diffGraphs(a.before as GraphSnapshot, a.after as GraphSnapshot) },
  { id: "graph.draft", summary: "Build a normalized proposed graph value, never a canonical write.", input_schema: object({ graph: draftInput }), output_schema: object({ status: { const: "proposed" }, preview: snapshot, canonical_write_allowed: { const: false }, digest: digestSchema }),
    execute: a => seal({ status: "proposed", preview: createGraphSnapshot(a.graph as GraphSnapshotInput), canonical_write_allowed: false }) },
  { id: "graph.validate", summary: "Check bounded shape, references and snapshot digest.", input_schema: object({ graph: snapshot }), output_schema: object({ valid: { const: true }, snapshot_digest: digestSchema, canonical_write_allowed: { const: false }, digest: digestSchema }),
    execute: a => { assertSnapshot(a.graph); return seal({ valid: true, snapshot_digest: a.graph.digest, canonical_write_allowed: false }); } },
  { id: "graph.propose_patch", summary: "Propose a base-bound metadata change with a validated preview.", input_schema: object({ graph: snapshot, patch }), output_schema: patchProposal,
    execute: a => proposeGraphPatch(a.graph as GraphSnapshot, a.patch as GraphPatch) },
  { id: "relation.propose", summary: "Propose a relation fact while preserving participants and qualifiers.", input_schema: object({ graph: snapshot, relation: relationSchema }), output_schema: patchProposal,
    execute: a => proposeGraphPatch(a.graph as GraphSnapshot, { upsert_objects: [], deprecate_objects: [], upsert_relations: [a.relation as GraphSnapshot["relations"][number]], deprecate_relations: [] }) },
  { id: "cluster.propose", summary: "Group authorized metadata deterministically; inference is a separate host operation.", input_schema: object({ graph: snapshot, policy: CLUSTER_POLICY_SCHEMA }), output_schema: proposal,
    execute: a => proposeRuleClusters(a.graph as GraphSnapshot, a.policy as ClusterPolicy) },
  { id: "cluster.evaluate", summary: "Measure coverage and optional oracle agreement, not semantic truth.", input_schema: object({ graph: snapshot, proposal,
    expected: { type: "object", maxProperties: 1000, propertyNames: referenceSchema, additionalProperties: ids } }, ["graph", "proposal"]), output_schema: readonlyOutput,
    execute: a => evaluateClusters(a.graph as GraphSnapshot, a.proposal as ClusterProposal, a.expected as Record<string, string[]> | undefined) },
  { id: "cluster.materialize_view", summary: "Return an ephemeral group view; no filesystem writes.", input_schema: object({ graph: snapshot, proposal, group_id: referenceSchema }), output_schema: view,
    execute: a => materializeClusterView(a.graph as GraphSnapshot, a.proposal as ClusterProposal, a.group_id as string) }
];

const catalogBody = { contract_version: "1.0.0", operations: definitions.map(({ execute: _execute, ...entry }) => ({ ...entry,
  version: "1.0.0", effect: "pure", canonical_write_allowed: false })).sort((a, b) => a.id < b.id ? -1 : 1) };
const catalog = seal(catalogBody);
const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
ajv.addSchema(GRAPH_SNAPSHOT_SCHEMA); ajv.addSchema(CLUSTER_PROPOSAL_SCHEMA); ajv.addSchema(COMPONENT_PACKAGE_SCHEMA);
const validators = new Map(definitions.map(d => [d.id, { input: ajv.compile(d.input_schema), output: ajv.compile(d.output_schema) }]));

export function standardOperationCatalog(): typeof catalog { return structuredClone(catalog); }

export function describeStandardOperation(id: string) {
  const operation = catalog.operations.find(x => x.id === id);
  requireCondition(operation, "unknown_standard_operation");
  return structuredClone(operation);
}

export function invokeStandardOperation(id: string, args: unknown, expectedCatalogDigest: string): unknown {
  requireCondition(expectedCatalogDigest === catalog.digest, "operation_catalog_digest_mismatch");
  const definition = definitions.find(x => x.id === id);
  requireCondition(definition, "unknown_standard_operation");
  requireJson(args);
  const validate = validators.get(id)!;
  requireCondition(validate.input(args), "standard_operation_input_invalid");
  const result = definition.execute(structuredClone(args) as Record<string, unknown>);
  requireJson(result);
  requireCondition(validate.output(result), "standard_operation_output_invalid");
  return result;
}

export function validateStandardOperationArgument(id: string, name: string, value: unknown): boolean {
  const definition = definitions.find(x => x.id === id);
  requireCondition(definition, "unknown_standard_operation");
  const properties = definition.input_schema.properties as Record<string, Schema>;
  requireCondition(properties[name], "unknown_standard_operation_argument");
  requireJson(value);
  return ajv.validate(properties[name], value) as boolean;
}

/** Opt-in binding by trusted host; never mutates the legacy default registry. */
export function createStandardPureAdapters(expectedCatalogDigest: string): PureAdapterRegistry {
  requireCondition(expectedCatalogDigest === catalog.digest, "operation_catalog_digest_mismatch");
  return { ...DEFAULT_PURE_ADAPTERS, mirai_stdlib: Object.fromEntries(definitions.map(d => [d.id,
    (args: Record<string, unknown>) => invokeStandardOperation(d.id, args, expectedCatalogDigest)])) };
}

export function standardOperationSchemas(): Record<string, unknown> {
  return { "graph-operation-snapshot.schema.json": GRAPH_SNAPSHOT_SCHEMA, "cluster-proposal.schema.json": CLUSTER_PROPOSAL_SCHEMA };
}

export const standardOperationCatalogDigest = (): string => digestValue(catalogBody);
