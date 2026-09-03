export const referenceSchema = { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.:-]{0,159}$" };
export const digestSchema = { type: "string", pattern: "^sha256:[a-f0-9]{64}$" };
export const scalarSchema = { anyOf: [{ type: "string", maxLength: 256 }, { type: "number" }, { type: "boolean" }] };
const refs = { type: "array", maxItems: 64, uniqueItems: true, items: referenceSchema };
const scalarMap = { type: "object", maxProperties: 64, propertyNames: referenceSchema, additionalProperties: scalarSchema };
export const entitySchema = {
  type: "object", additionalProperties: false,
  required: ["id", "kind", "scope", "metadata", "source_refs"],
  properties: {
    id: referenceSchema, kind: referenceSchema, scope: referenceSchema, source_refs: refs,
    metadata: { type: "object", maxProperties: 64, propertyNames: referenceSchema,
      additionalProperties: { anyOf: [scalarSchema, { type: "array", maxItems: 64, uniqueItems: true, items: scalarSchema }] } }
  }
};
export const sourceRefSchema = {
  type: "object", additionalProperties: false, required: ["id", "owner_ref", "digest", "confidentiality"],
  properties: { id: referenceSchema, owner_ref: referenceSchema, digest: digestSchema,
    confidentiality: { enum: ["public", "internal", "restricted"] } }
};
export const relationSchema = {
  type: "object", additionalProperties: false,
  required: ["contract_version", "id", "type", "participants", "priority", "authority", "confidence", "provenance"],
  properties: {
    contract_version: { const: "1.0.0" }, id: referenceSchema, type: referenceSchema,
    participants: { type: "array", minItems: 2, maxItems: 64, items: {
      type: "object", additionalProperties: false, required: ["ref", "role"], properties: { ref: referenceSchema, role: referenceSchema }
    } },
    qualifiers: scalarMap, conditions: scalarMap, scope: referenceSchema,
    valid_from: { type: "string", format: "date-time" }, valid_until: { type: "string", format: "date-time" },
    priority: { type: "integer", minimum: -1000000, maximum: 1000000 },
    authority: { enum: ["canonical", "owner_asserted", "derived", "proposal"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: { type: "array", minItems: 1, maxItems: 64, items: {
      type: "object", additionalProperties: false, required: ["source_ref"], properties: { source_ref: referenceSchema, evidence_ref: referenceSchema }
    } },
    activation_rule: { type: "object", additionalProperties: false, required: ["signal_type"],
      properties: { signal_type: referenceSchema, operation: referenceSchema } }
  }
};

export const GRAPH_SNAPSHOT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/graph-operation-snapshot.schema.json",
  type: "object", additionalProperties: false,
  required: ["contract_version", "id", "objects", "relations", "sources", "canonical_write_allowed", "digest"],
  properties: {
    contract_version: { const: "1.0.0" }, id: referenceSchema, digest: digestSchema,
    objects: { type: "array", maxItems: 10000, items: entitySchema },
    relations: { type: "array", maxItems: 40000, items: relationSchema },
    sources: { type: "array", maxItems: 10000, items: sourceRefSchema },
    canonical_write_allowed: { const: false }
  }
};
