import { digestSchema, referenceSchema } from "../stdlib/schema.js";

const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
const ids = { type: "array", uniqueItems: true, maxItems: 10000, items: referenceSchema };
const requestProperties = { id: referenceSchema, parent_id: { anyOf: [referenceSchema, { type: "null" }] },
  receiver_id: referenceSchema, receiver_digest: digestSchema, object_ids: ids,
  input: { type: "object", maxProperties: 64 },
  dependencies: { type: "array", maxItems: 256, items: object({ task_id: referenceSchema, requires: { enum: ["verified", "accepted"] } }) },
  required_evidence: { ...ids, minItems: 1, maxItems: 64 }, deadline: { type: "string", format: "date-time" },
  outcome: { type: "string", minLength: 1, maxLength: 256 },
  outcome_contract_ref: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.:/-]{0,511}$" },
  outcome_contract_digest: digestSchema
};
const request = object(requestProperties, Object.keys(requestProperties).filter((key) => !key.startsWith("outcome_contract_")));

export const TASK_PLAN_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/task-plan.schema.json",
  title: "Mirai bounded local task plan (development)",
  ...object({ contract_version: { const: "1.0.0" }, id: referenceSchema, graph_digest: digestSchema,
    policy_digest: digestSchema, catalog_digest: digestSchema,
    requests: { type: "array", minItems: 1, maxItems: 256, items: request },
    canonical_write_allowed: { const: false }, digest: digestSchema })
};

export const TASK_POLICY_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/task-policy.schema.json",
  title: "Mirai bounded task host policy declaration, not a grant",
  ...object({ id: referenceSchema, owner: referenceSchema, reviewers: { ...ids, minItems: 1, maxItems: 256 },
    participants: { type: "array", minItems: 1, maxItems: 256, items: object({ id: referenceSchema, object_ids: ids, source_ids: ids, delegate_to: { ...ids, maxItems: 256 } }) },
    max_depth: { type: "integer", minimum: 1, maximum: 8 }, max_tasks: { type: "integer", minimum: 1, maximum: 256 },
    max_parallel: { type: "integer", minimum: 1, maximum: 16 }, max_duration_ms: { type: "integer", minimum: 1, maximum: 300000 },
    max_output_bytes: { type: "integer", minimum: 1, maximum: 1000000 }, max_model_calls: { type: "integer", minimum: 0, maximum: 256 }, digest: digestSchema })
};
