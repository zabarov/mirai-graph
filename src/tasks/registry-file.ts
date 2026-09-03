import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { digestValue } from "../core/canonical.js";
import { assertNoSymlinkComponents, resolveConfinedPath } from "../core/path-boundary.js";
import { MIRAI_PROGRAM_SCHEMA } from "../program/schema.js";
import { validateProgram, valueMatchesType } from "../program/validator.js";
import type { MiraiProgram, TypeSpec } from "../program/types.js";
import { digestSchema, referenceSchema } from "../stdlib/schema.js";
import { requireCondition, requireJson } from "../stdlib/graph.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import { programTaskReceiver } from "./receivers.js";
import { taskRuntimeRegistryDigest, type TaskRuntimeRegistry } from "./runtime-bridge.js";
import type { TaskPlan, TaskPolicy, TaskReceiver, TaskProviderResult } from "./types.js";

const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const ref = object({ path: { type: "string", minLength: 1, maxLength: 512 }, content_digest: digestSchema });
const type = { $ref: `${MIRAI_PROGRAM_SCHEMA.$id}#/$defs/typeSpec` };
const result = object({ output: { type: "object", maxProperties: 64 },
  evidence: { type: "array", minItems: 1, maxItems: 64, items: object({ id: referenceSchema, digest: digestSchema }) } });
export const RECORDED_TASK_RECEIVER_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/recorded-task-receiver.schema.json",
  ...object({ contract_version: { const: "1.0.0" }, id: referenceSchema, kind: { const: "recorded_ai" }, input_type: type, output_type: type,
    recordings: { type: "array", minItems: 1, maxItems: 256, items: object({ task_id: referenceSchema, input_digest: digestSchema,
      view_digest: digestSchema, dependencies_digest: digestSchema, result }) } })
};
export const TASK_REGISTRY_FILE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/task-registry-file.schema.json",
  ...object({ contract_version: { const: "1.0.0" }, graph: ref, policy: ref, plan: ref,
    receivers: { type: "array", minItems: 1, maxItems: 256, items: { oneOf: [
      { ...object({ kind: { const: "program" }, id: referenceSchema, program: ref, evidence_id: referenceSchema,
        programs: { type: "object", maxProperties: 64, propertyNames: referenceSchema, additionalProperties: ref } }),
        required: ["kind", "id", "program", "evidence_id"] },
      object({ kind: { const: "recorded_ai" }, recording: ref })
    ] } }, canonical_write_allowed: { const: false } })
};
interface DataRef { path: string; content_digest: string }
export interface RecordedTaskReceiver {
  contract_version: "1.0.0";
  id: string;
  kind: "recorded_ai";
  input_type: TypeSpec;
  output_type: TypeSpec;
  recordings: Array<{ task_id: string; input_digest: string; view_digest: string; dependencies_digest: string; result: TaskProviderResult }>;
}
export interface TaskRegistryFile {
  contract_version: "1.0.0";
  graph: DataRef;
  policy: DataRef;
  plan: DataRef;
  receivers: Array<{ kind: "program"; id: string; program: DataRef; evidence_id: string; programs?: Record<string, DataRef> } | { kind: "recorded_ai"; recording: DataRef }>;
  canonical_write_allowed: false;
}
const ajv = new Ajv2020({ strict: false }); addFormats(ajv); ajv.addSchema(MIRAI_PROGRAM_SCHEMA);
const registryShape = ajv.compile<TaskRegistryFile>(TASK_REGISTRY_FILE_SCHEMA);
const recordedShape = ajv.compile<RecordedTaskReceiver>(RECORDED_TASK_RECEIVER_SCHEMA);

export function recordedTaskReceiver(value: RecordedTaskReceiver): TaskReceiver {
  requireJson(value); requireCondition(recordedShape(value), "recorded_receiver_shape_invalid");
  const definition = structuredClone(value);
  const keys = definition.recordings.map(r => digestValue({ task: r.task_id, input: r.input_digest, view: r.view_digest, dependencies: r.dependencies_digest }));
  requireCondition(new Set(keys).size === keys.length, "recorded_receiver_ambiguous_case");
  for (const entry of definition.recordings) {
    requireCondition(valueMatchesType(entry.result.output, definition.output_type), "recorded_receiver_output_type_invalid");
    requireCondition(new Set(entry.result.evidence.map(e => e.id)).size === entry.result.evidence.length, "recorded_receiver_duplicate_evidence");
  }
  return { id: definition.id, kind: "ai", digest: digestValue(definition), input_type: definition.input_type, output_type: definition.output_type,
    async execute(input, context) {
      requireCondition(!context.signal.aborted, "task_cancelled");
      requireCondition(valueMatchesType(input, definition.input_type), "recorded_receiver_input_type_invalid");
      const key = digestValue({ task: context.task_id, input: digestValue(input), view: context.view.digest, dependencies: digestValue(context.dependencies) });
      const index = keys.indexOf(key);
      requireCondition(index >= 0, "recorded_receiver_context_not_found");
      return structuredClone(definition.recordings[index]!.result);
    } };
}

/** Explicit host input. Program IR imports are data, never code or network lookup. */
export function loadTaskRuntimeRegistry(filename: string): TaskRuntimeRegistry {
  const manifest = path.resolve(filename);
  assertNoSymlinkComponents(manifest, false, "task_registry");
  const root = path.dirname(manifest);
  requireCondition(!fs.lstatSync(root).isSymbolicLink(), "task_registry_root_symlink_forbidden");
  let totalBytes = 0;
  const read = (target: string): unknown => {
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(fd); const limit = 8 * 1024 * 1024;
      requireCondition(stat.isFile() && stat.size <= limit && totalBytes + stat.size <= 32 * 1024 * 1024, "task_registry_read_budget_exceeded");
      const buffer = Buffer.alloc(limit + 1); let size = 0, count = 0;
      while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null)) > 0) size += count;
      totalBytes += size;
      requireCondition(size <= limit && totalBytes <= 32 * 1024 * 1024, "task_registry_read_budget_exceeded");
      let value: unknown;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
        const document = YAML.parseDocument(text, { uniqueKeys: true, prettyErrors: false });
        requireCondition(!document.errors.length, "task_registry_json_invalid");
        value = JSON.parse(text);
      } catch { throw new Error("task_registry_json_invalid"); }
      requireJson(value); return value;
    } finally { fs.closeSync(fd); }
  };
  const config = read(manifest);
  requireCondition(registryShape(config), "task_registry_file_invalid");
  const cache = new Map<string, unknown>();
  const referenced = (reference: DataRef): unknown => {
    requireCondition(!reference.path.includes("\\") && !reference.path.includes(":") && !reference.path.split("/").some(s => s === ".." || s === "." || !s), "task_registry_reference_invalid");
    const target = resolveConfinedPath(root, reference.path, { label: "task_registry_reference" });
    let value = cache.get(target);
    if (value === undefined) { value = read(target); cache.set(target, value); }
    requireCondition(digestValue(value) === reference.content_digest, "task_registry_content_digest_mismatch");
    return structuredClone(value);
  };
  const receivers = config.receivers.map(r => {
    if (r.kind === "recorded_ai") return recordedTaskReceiver(referenced(r.recording) as RecordedTaskReceiver);
    const program = referenced(r.program) as MiraiProgram;
    requireCondition(validateProgram(program).valid, "task_registry_program_invalid");
    const programs = Object.fromEntries(Object.entries(r.programs || {}).map(([id, reference]) => [id, referenced(reference) as MiraiProgram]));
    return programTaskReceiver({ id: r.id, program, evidence_id: r.evidence_id, programs });
  });
  const registry = { graph: referenced(config.graph) as GraphSnapshot, policy: referenced(config.policy) as TaskPolicy,
    plans: [referenced(config.plan) as TaskPlan], receivers };
  taskRuntimeRegistryDigest(registry);
  return registry;
}
