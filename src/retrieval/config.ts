import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { canonicalize, digestValue, resolveConfinedPath } from "../core/index.js";
import type { RetrievalProjectConfig } from "./types.js";

export const RETRIEVAL_CONFIG_PATH = "mirai/retrieval.yaml";
export const RETRIEVAL_INDEX_ROOT = ".mirai/indexes";

const ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const FORBIDDEN = new Set(["approval", "approvals", "capability", "capabilities", "canonical_write_allowed", "credential", "credentials", "secret", "token"]);
const SENSITIVE_VALUE = /(?:-----?BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----?|\b(?:ghp_|github_pat_|sk-proj-|xoxb-)[A-Za-z0-9_-]{8,}|\bAKIA[0-9A-Z]{16}\b|\/Users\/|[A-Za-z]:\\Users\\)/u;

function fail(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function assertKeys(value: unknown, allowed: string[], at: string): void {
  fail(value && typeof value === "object" && !Array.isArray(value), `retrieval_config_object_required:${at}`);
  for (const key of Object.keys(value as Record<string, unknown>)) fail(allowed.includes(key), `retrieval_config_unknown_field:${at}.${key}`);
}

function assertNoAuthorityOrSecrets(value: unknown, at = "retrieval"): void {
  if (typeof value === "string") {
    fail(!SENSITIVE_VALUE.test(value), `retrieval_config_sensitive_value:${at}`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoAuthorityOrSecrets(item, `${at}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    fail(!FORBIDDEN.has(key.toLowerCase()), `retrieval_config_forbidden_field:${at}.${key}`);
    assertNoAuthorityOrSecrets(child, `${at}.${key}`);
  }
}

function strings(value: unknown, at: string): string[] {
  fail(Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0), `retrieval_config_string_array_required:${at}`);
  fail(new Set(value).size === value.length, `retrieval_config_duplicate_value:${at}`);
  return [...value] as string[];
}

function integer(value: unknown, at: string, min: number, max: number): number {
  fail(Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max, `retrieval_config_budget_invalid:${at}`);
  return Number(value);
}

export function validateRetrievalConfig(value: unknown, projectRoot?: string): RetrievalProjectConfig {
  assertNoAuthorityOrSecrets(value);
  assertKeys(value, ["contract_version", "index_id", "project_id", "inputs", "access", "placement", "semantic", "budgets"], "retrieval");
  const root = value as Record<string, unknown>;
  fail(root.contract_version === "1.0.0", "retrieval_config_contract_unsupported");
  fail(typeof root.index_id === "string" && ID.test(root.index_id), "retrieval_config_index_id_invalid");
  fail(typeof root.project_id === "string" && ID.test(root.project_id), "retrieval_config_project_id_invalid");
  fail(Array.isArray(root.inputs) && root.inputs.length > 0 && root.inputs.length <= 32, "retrieval_config_inputs_invalid");
  const inputs = root.inputs.map((item, index) => {
    assertKeys(item, ["kind", "path", "snapshot_digest"], `inputs[${index}]`);
    const input = item as Record<string, unknown>;
    fail(["normalized_units", "graph_snapshot", "programs", "policies", "evidence"].includes(String(input.kind)), `retrieval_config_input_kind_invalid:${index}`);
    fail(typeof input.path === "string" && input.path.length > 0, `retrieval_config_input_path_invalid:${index}`);
    if (input.snapshot_digest !== undefined) fail(typeof input.snapshot_digest === "string" && DIGEST.test(input.snapshot_digest), `retrieval_config_snapshot_digest_invalid:${index}`);
    if (projectRoot) resolveConfinedPath(projectRoot, input.path as string, { allow_missing: false, label: "retrieval_input" });
    return { kind: input.kind, path: input.path, ...(input.snapshot_digest ? { snapshot_digest: input.snapshot_digest } : {}) } as RetrievalProjectConfig["inputs"][number];
  });
  assertKeys(root.access, ["principal_id", "purpose", "scopes", "source_refs", "document_ids", "policy_digest"], "access");
  const access = root.access as Record<string, unknown>;
  fail(typeof access.principal_id === "string" && ID.test(access.principal_id), "retrieval_config_principal_invalid");
  fail(typeof access.purpose === "string" && access.purpose.length > 0 && access.purpose.length <= 512, "retrieval_config_purpose_invalid");
  fail(typeof access.policy_digest === "string" && DIGEST.test(access.policy_digest), "retrieval_config_policy_digest_invalid");
  assertKeys(root.placement, ["mode", "confidential_mode", "max_snippet_chars"], "placement");
  const placement = root.placement as Record<string, unknown>;
  fail(placement.mode === "minimal_projection" && placement.confidential_mode === "reference_only", "retrieval_config_placement_unsafe");
  assertKeys(root.semantic, ["provider", "model", "dimensions"], "semantic");
  const semantic = root.semantic as Record<string, unknown>;
  fail(["disabled", "local", "external"].includes(String(semantic.provider)), "retrieval_config_semantic_provider_invalid");
  if (semantic.provider !== "disabled") {
    fail(typeof semantic.model === "string" && semantic.model.length > 0, "retrieval_config_semantic_model_required");
    fail(Number.isSafeInteger(semantic.dimensions) && Number(semantic.dimensions) > 0 && Number(semantic.dimensions) <= 4096, "retrieval_config_semantic_dimensions_invalid");
  }
  assertKeys(root.budgets, ["max_documents", "max_index_bytes", "max_query_results", "max_graph_depth", "max_fan_out", "max_hops", "timeout_ms"], "budgets");
  const budgets = root.budgets as Record<string, unknown>;
  const config: RetrievalProjectConfig = {
    contract_version: "1.0.0",
    index_id: root.index_id,
    project_id: root.project_id,
    inputs,
    access: {
      principal_id: access.principal_id as string,
      purpose: access.purpose as string,
      scopes: strings(access.scopes, "access.scopes"),
      source_refs: strings(access.source_refs, "access.source_refs"),
      ...(access.document_ids ? { document_ids: strings(access.document_ids, "access.document_ids") } : {}),
      policy_digest: access.policy_digest as string
    },
    placement: { mode: "minimal_projection", confidential_mode: "reference_only", max_snippet_chars: integer(placement.max_snippet_chars, "max_snippet_chars", 32, 2048) },
    semantic: {
      provider: semantic.provider as "disabled" | "local" | "external",
      ...(semantic.model ? { model: semantic.model as string } : {}),
      ...(semantic.dimensions ? { dimensions: Number(semantic.dimensions) } : {})
    },
    budgets: {
      max_documents: integer(budgets.max_documents, "max_documents", 1, 1_000_000),
      max_index_bytes: integer(budgets.max_index_bytes, "max_index_bytes", 1024, 4 * 1024 * 1024 * 1024),
      max_query_results: integer(budgets.max_query_results, "max_query_results", 1, 1000),
      max_graph_depth: integer(budgets.max_graph_depth, "max_graph_depth", 1, 64),
      max_fan_out: integer(budgets.max_fan_out, "max_fan_out", 1, 64),
      max_hops: integer(budgets.max_hops, "max_hops", 1, 16),
      timeout_ms: integer(budgets.timeout_ms, "timeout_ms", 10, 300_000)
    }
  };
  return canonicalize(config) as RetrievalProjectConfig;
}

export function readRetrievalConfig(projectRoot: string): RetrievalProjectConfig {
  const root = path.resolve(projectRoot);
  const filename = resolveConfinedPath(root, RETRIEVAL_CONFIG_PATH, { allow_missing: false, label: "retrieval_config" });
  const source = fs.readFileSync(filename, "utf8");
  if (/(^|[\s\[{,])[&*][A-Za-z0-9_-]+/m.test(source)) throw new Error("retrieval_yaml_aliases_not_allowed");
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new Error(`retrieval_yaml_invalid:${document.errors.map((item) => item.message).join(";")}`);
  return validateRetrievalConfig(document.toJS({ maxAliasCount: 0 }), root);
}

export function retrievalConfigurationDigest(config: RetrievalProjectConfig): string {
  return digestValue(config);
}

export function retrievalIndexDirectory(projectRoot: string, indexId: string): string {
  if (!ID.test(indexId)) throw new Error("retrieval_index_id_invalid");
  return resolveConfinedPath(path.resolve(projectRoot), `${RETRIEVAL_INDEX_ROOT}/${indexId}`, { allow_missing: true, label: "retrieval_index" });
}
