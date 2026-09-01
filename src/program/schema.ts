export const MIRAI_PROGRAM_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/mirai-program.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["contract_version", "id", "version", "imports", "inputs", "outputs", "state", "nodes", "entry", "error_routes", "policies", "source_map", "digest"],
  properties: {
    contract_version: { const: "1.0.0" },
    id: { $ref: "#/$defs/id" },
    version: { type: "string", minLength: 1 },
    imports: { type: "array", items: { type: "object", required: ["alias", "ref", "digest"], properties: { alias: { $ref: "#/$defs/id" }, ref: { type: "string", minLength: 1 }, digest: { $ref: "#/$defs/digest" } }, additionalProperties: false } },
    inputs: { $ref: "#/$defs/slots" },
    outputs: { $ref: "#/$defs/slots" },
    state: { $ref: "#/$defs/slots" },
    nodes: { type: "array", minItems: 1, items: { type: "object", required: ["id", "kind"], properties: { id: { $ref: "#/$defs/id" }, kind: { enum: ["call", "branch", "match", "foreach", "parallel", "await", "retry", "timeout", "cancel", "compensate", "emit", "return"] } } } },
    entry: { $ref: "#/$defs/id" },
    error_routes: { type: "array", items: { type: "object", required: ["error", "to"], properties: { error: { type: "string", minLength: 1 }, to: { $ref: "#/$defs/id" } }, additionalProperties: false } },
    policies: { type: "object", additionalProperties: false, required: ["budgets", "allowed_effects", "canonical_write_allowed"], properties: {
      budgets: { type: "object", additionalProperties: false, required: ["max_steps", "max_depth", "max_iterations", "max_parallel", "max_duration_ms"], properties: {
        max_steps: { type: "integer", minimum: 1 }, max_depth: { type: "integer", minimum: 1 }, max_iterations: { type: "integer", minimum: 1 }, max_parallel: { type: "integer", minimum: 1 }, max_duration_ms: { type: "integer", minimum: 1 }
      } },
      allowed_effects: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
      canonical_write_allowed: { const: false }
    } },
    source_map: { type: "object", additionalProperties: { type: "object", required: ["file"], properties: { file: { type: "string", minLength: 1 }, line: { type: "integer", minimum: 1 } }, additionalProperties: false } },
    digest: { $ref: "#/$defs/digest" }
  },
  $defs: {
    id: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:/@+*?=-]{1,255}$" },
    digest: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    slots: { type: "array", items: { type: "object", required: ["id", "type"], properties: { id: { $ref: "#/$defs/id" }, type: {}, required: { type: "boolean" }, default: {} }, additionalProperties: false } }
  }
} as const;
