import fs from "node:fs";
import path from "node:path";
import { create, insertMultiple, load, save, search, type AnyOrama, type AnySchema, type RawData } from "@orama/orama";
import { digestValue, resolveConfinedPath } from "../core/index.js";
import { assertSnapshot } from "../stdlib/graph.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import type { NormalizedUnit } from "../sources/types.js";
import { readRetrievalConfig, retrievalConfigurationDigest, retrievalIndexDirectory } from "./config.js";
import { createRetrievalAnswer, planRetrieval, reciprocalRankFusion, sortHits } from "./planner.js";
import type { EmbeddingProvider, EvidenceBundle, RetrievalChannel, RetrievalDocument, RetrievalHit, RetrievalIndexDescriptor, RetrievalInputConfig, RetrievalProjectConfig, RetrievalRequest } from "./types.js";

const PROVIDER_VERSION = "@orama/orama@3.1.18";
const SENSITIVE = /(?:-----?BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----?|\b(?:ghp_|github_pat_|sk-proj-|xoxb-)[A-Za-z0-9_-]{8,}|\bAKIA[0-9A-Z]{16}\b|(?:^|[\s,{])["']?[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*["']?\s*[:=]\s*["']?[^\s"',}\]]{4,}|\/Users\/|[A-Za-z]:\\Users\\)/imu;

type OramaDocument = Omit<RetrievalDocument, "digest" | "embedding"> & { digest: string; embedding?: number[] };

function fail(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, "utf8")) as unknown;
}

function contentText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function boundedText(value: string, max: number): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, max);
}

function documentDigest(document: Omit<RetrievalDocument, "digest">): RetrievalDocument {
  return { ...document, digest: digestValue(document) };
}

function authorized(config: RetrievalProjectConfig, sourceRef: string, scope: string, documentId: string): boolean {
  return config.access.source_refs.includes(sourceRef) && config.access.scopes.includes(scope) && (!config.access.document_ids || config.access.document_ids.includes(documentId));
}

function referenceOnly(confidentiality: RetrievalDocument["confidentiality"]): boolean {
  return confidentiality === "confidential" || confidentiality === "restricted";
}

function assertNormalizedUnit(unit: unknown): asserts unit is NormalizedUnit {
  fail(Boolean(unit) && typeof unit === "object" && !Array.isArray(unit), "retrieval_normalized_unit_invalid");
  const value = unit as Record<string, unknown>;
  const allowed = new Set(["contract_version", "id", "source_ref", "source_fingerprint", "kind", "media_type", "ordinal", "content", "content_digest", "source_span", "authority", "scope", "confidentiality", "instructions_authorized"]);
  fail(Object.keys(value).every((key) => allowed.has(key)), "retrieval_normalized_unit_unknown_field");
  fail(value.contract_version === "1.0.0" && value.instructions_authorized === false, "retrieval_normalized_unit_contract_invalid");
  fail(typeof value.id === "string" && value.id.length > 0 && typeof value.source_ref === "string" && value.source_ref.length > 0, "retrieval_normalized_unit_identity_invalid");
  fail(typeof value.source_fingerprint === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.source_fingerprint), "retrieval_normalized_unit_source_digest_invalid");
  fail(typeof value.content_digest === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.content_digest), "retrieval_normalized_unit_content_digest_invalid");
  fail(["text", "record", "table", "document_fragment"].includes(String(value.kind)), "retrieval_normalized_unit_kind_invalid");
  fail(typeof value.media_type === "string" && value.media_type.length > 0 && Number.isSafeInteger(value.ordinal) && Number(value.ordinal) >= 0, "retrieval_normalized_unit_shape_invalid");
  fail(["informational", "supporting", "owner_asserted", "canonical_external"].includes(String(value.authority)), "retrieval_normalized_unit_authority_invalid");
  fail(typeof value.scope === "string" && value.scope.length > 0, "retrieval_normalized_unit_scope_invalid");
  fail(["public", "internal", "confidential", "restricted"].includes(String(value.confidentiality)), "retrieval_normalized_unit_confidentiality_required");
}

function unitDocument(unit: NormalizedUnit, config: RetrievalProjectConfig): RetrievalDocument | null {
  assertNormalizedUnit(unit);
  fail(!SENSITIVE.test(unit.id) && !SENSITIVE.test(unit.source_ref), "retrieval_sensitive_reference_rejected");
  if (!authorized(config, unit.source_ref, unit.scope, unit.id)) return null;
  const raw = contentText(unit.content);
  const referenceOnly = unit.confidentiality === "confidential" || unit.confidentiality === "restricted" || SENSITIVE.test(raw);
  const searchText = referenceOnly ? `${unit.id} ${unit.source_ref} ${unit.kind} ${unit.media_type}` : boundedText(raw, 8192);
  const snippet = referenceOnly ? "" : boundedText(raw, config.placement.max_snippet_chars);
  return documentDigest({
    id: unit.id,
    kind: unit.kind,
    title: referenceOnly ? unit.id : unit.source_span?.section || unit.id,
    search_text: searchText,
    snippet,
    source_ref: unit.source_ref,
    source_digest: unit.source_fingerprint,
    scope: unit.scope,
    authority: unit.authority,
    freshness: "current",
    confidentiality: unit.confidentiality,
    graph_object_refs: [],
    evidence_refs: [unit.source_ref],
    program_refs: [],
    policy_refs: []
  });
}

function graphDocuments(graph: GraphSnapshot, config: RetrievalProjectConfig): RetrievalDocument[] {
  assertSnapshot(graph);
  const sources = new Map(graph.sources.map((source) => [source.id, source]));
  const objects = graph.objects.flatMap((object): RetrievalDocument[] => {
    const sourceRef = object.source_refs[0];
    if (!sourceRef || !authorized(config, sourceRef, object.scope, object.id)) return [];
    const source = sources.get(sourceRef);
    const raw = JSON.stringify(object.metadata);
    const referenceOnly = SENSITIVE.test(raw) || source?.confidentiality === "restricted";
    const text = referenceOnly ? `${object.id} ${object.kind}` : boundedText(raw, 8192);
    return [documentDigest({
      id: `graph.object:${object.id}`,
      kind: object.kind,
      title: object.id,
      search_text: `${object.id} ${object.kind} ${text}`,
      snippet: referenceOnly ? "" : boundedText(raw, config.placement.max_snippet_chars),
      source_ref: sourceRef,
      source_digest: source?.digest || graph.digest,
      scope: object.scope,
      authority: "canonical",
      freshness: "current",
      confidentiality: source?.confidentiality || "internal",
      graph_object_refs: [object.id],
      evidence_refs: object.source_refs,
      program_refs: object.kind.includes("program") || object.kind.includes("technology") ? [object.id] : [],
      policy_refs: object.kind.includes("policy") || object.kind.includes("gate") ? [object.id] : []
    })];
  });
  const relations = graph.relations.flatMap((relation): RetrievalDocument[] => {
    const sourceRef = relation.provenance[0]?.source_ref;
    const scope = relation.scope || "global";
    if (!sourceRef || !authorized(config, sourceRef, scope, relation.id)) return [];
    const source = sources.get(sourceRef);
    const participants = relation.participants.map((participant) => `${participant.role}:${participant.ref}`);
    const referenceOnly = source?.confidentiality === "restricted";
    return [documentDigest({
      id: `graph.relation:${relation.id}`,
      kind: `relation:${relation.type}`,
      title: relation.id,
      search_text: referenceOnly ? `${relation.id} relation` : `${relation.type} ${participants.join(" ")}`,
      snippet: referenceOnly ? "" : `${relation.type}: ${participants.join(", ")}`.slice(0, config.placement.max_snippet_chars),
      source_ref: sourceRef,
      source_digest: sources.get(sourceRef)?.digest || graph.digest,
      scope,
      authority: relation.authority,
      freshness: "current",
      confidentiality: sources.get(sourceRef)?.confidentiality || "internal",
      graph_object_refs: referenceOnly ? [] : relation.participants.map((participant) => participant.ref),
      evidence_refs: referenceOnly ? [sourceRef] : relation.provenance.flatMap((item) => [item.source_ref, ...(item.evidence_ref ? [item.evidence_ref] : [])]),
      program_refs: [],
      policy_refs: []
    })];
  });
  return [...objects, ...relations];
}

function genericDocuments(value: unknown, kind: string, sourceRef: string, sourceDigest: string, config: RetrievalProjectConfig): RetrievalDocument[] {
  fail(!SENSITIVE.test(sourceRef), "retrieval_sensitive_reference_rejected");
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry, index): RetrievalDocument[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const sourceId = typeof record.id === "string" ? record.id : `${kind}.${index}`;
    const id = SENSITIVE.test(sourceId) ? `redacted.${digestValue(sourceId).slice(7, 23)}` : sourceId;
    const scope = typeof record.scope === "string" ? record.scope : config.access.scopes[0] as string;
    const documentId = `${kind}:${id}`;
    if (!authorized(config, sourceRef, scope, documentId)) return [];
    const raw = JSON.stringify(record);
    const declared = ["public", "internal", "confidential", "restricted"].includes(String(record.confidentiality)) ? record.confidentiality as RetrievalDocument["confidentiality"] : "internal";
    const sensitive = SENSITIVE.test(raw);
    const referenceOnly = sensitive || declared === "confidential" || declared === "restricted";
    const confidentiality = sensitive ? "restricted" as const : declared;
    const publicTitle = typeof record.title === "string" ? record.title : typeof record.name === "string" ? record.name : id;
    const safeTitle = SENSITIVE.test(publicTitle) ? id : publicTitle;
    const title = referenceOnly ? id : safeTitle;
    const freshness = ["current", "aging", "stale", "unknown"].includes(String(record.freshness)) ? record.freshness as RetrievalDocument["freshness"] : "current";
    const conflictRefs = Array.isArray(record.conflict_refs) ? record.conflict_refs.filter((item): item is string => typeof item === "string") : [];
    return [documentDigest({
      id: documentId,
      kind,
      title,
      search_text: referenceOnly ? `${id} ${kind} ${sourceRef}` : boundedText(raw, 8192),
      snippet: referenceOnly ? "" : boundedText(raw, config.placement.max_snippet_chars),
      source_ref: sourceRef,
      source_digest: sourceDigest,
      scope,
      authority: "owner_asserted",
      freshness,
      confidentiality,
      graph_object_refs: [],
      evidence_refs: [sourceRef],
      program_refs: kind === "program" ? [id] : [],
      policy_refs: kind === "policy" ? [id] : [],
      ...(conflictRefs.length ? { conflict_refs: conflictRefs } : {})
    })];
  });
}

function inputFiles(projectRoot: string, relative: string): string[] {
  const target = resolveConfinedPath(projectRoot, relative, { allow_missing: false, label: "retrieval_input" });
  const stat = fs.lstatSync(target);
  fail(!stat.isSymbolicLink(), "retrieval_input_symlink_rejected");
  if (stat.isFile()) return [target];
  fail(stat.isDirectory(), "retrieval_input_type_unsupported");
  const result: string[] = [];
  const walk = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name);
      const item = fs.lstatSync(filename);
      fail(!item.isSymbolicLink(), "retrieval_input_symlink_rejected");
      if (item.isDirectory()) walk(filename);
      else if (item.isFile() && filename.endsWith(".json")) result.push(filename);
    }
  };
  walk(target);
  return result;
}

function portableInputRef(projectRoot: string, configuredPath: string, filename: string): string {
  const target = resolveConfinedPath(projectRoot, configuredPath, { allow_missing: false, label: "retrieval_input" });
  if (fs.lstatSync(target).isFile()) return configuredPath.replaceAll("\\", "/");
  return path.posix.join(configuredPath.replaceAll("\\", "/"), path.relative(target, filename).replaceAll(path.sep, "/"));
}

function inputDocumentKind(kind: RetrievalInputConfig["kind"]): string {
  if (kind === "programs") return "program";
  if (kind === "policies") return "policy";
  if (kind === "evidence") return "evidence";
  return kind;
}

export function collectRetrievalDocuments(projectRoot: string, config: RetrievalProjectConfig): { documents: RetrievalDocument[]; graph: GraphSnapshot | undefined; snapshotDigests: string[] } {
  const documents: RetrievalDocument[] = [];
  let graph: GraphSnapshot | undefined;
  const snapshots: string[] = [];
  for (const input of config.inputs) {
    for (const filename of inputFiles(projectRoot, input.path)) {
      const raw = readJson(filename);
      const fileDigest = digestValue(raw);
      if (input.snapshot_digest && input.snapshot_digest !== fileDigest) throw new Error("retrieval_input_snapshot_digest_mismatch");
      snapshots.push(fileDigest);
      if (input.kind === "normalized_units") {
        const units = Array.isArray(raw) ? raw : (raw as { units?: unknown }).units;
        fail(Array.isArray(units), "retrieval_units_array_required");
        documents.push(...(units as NormalizedUnit[]).map((unit) => unitDocument(unit, config)).filter((item): item is RetrievalDocument => Boolean(item)));
      } else if (input.kind === "graph_snapshot") {
        graph = raw as GraphSnapshot;
        documents.push(...graphDocuments(graph, config));
      } else {
        documents.push(...genericDocuments(raw, inputDocumentKind(input.kind), portableInputRef(projectRoot, input.path, filename), fileDigest, config));
      }
    }
  }
  const byId = new Map<string, RetrievalDocument>();
  for (const document of documents) {
    const previous = byId.get(document.id);
    fail(!previous || previous.digest === document.digest, `retrieval_document_id_conflict:${document.id}`);
    byId.set(document.id, document);
  }
  const sorted = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  fail(sorted.length <= config.budgets.max_documents, "retrieval_document_budget_exceeded");
  return { documents: sorted, graph, snapshotDigests: [...new Set(snapshots)].sort() };
}

function oramaSchema(dimensions?: number): AnySchema {
  return {
    id: "string", kind: "string", title: "string", search_text: "string", snippet: "string", source_ref: "string", source_digest: "string",
    scope: "string", authority: "string", freshness: "string", confidentiality: "string", graph_object_refs: "string[]", evidence_refs: "string[]",
    program_refs: "string[]", policy_refs: "string[]", conflict_refs: "string[]", digest: "string", ...(dimensions ? { embedding: `vector[${dimensions}]` } : {})
  };
}

function createDatabase(dimensions?: number): AnyOrama {
  return create({ schema: oramaSchema(dimensions) }) as AnyOrama;
}

function writeAtomicJson(filename: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filename);
}

function replaceIndexDirectory(directory: string, files: Record<string, unknown>): void {
  const staging = `${directory}.staging-${process.pid}`;
  const backup = `${directory}.previous-${process.pid}`;
  fail(!fs.existsSync(staging) && !fs.existsSync(backup), "retrieval_index_transaction_collision");
  fs.mkdirSync(staging, { recursive: true, mode: 0o700 });
  try {
    for (const [name, value] of Object.entries(files)) writeAtomicJson(path.join(staging, name), value);
    if (fs.existsSync(directory)) fs.renameSync(directory, backup);
    try {
      fs.renameSync(staging, directory);
    } catch (error) {
      if (fs.existsSync(backup) && !fs.existsSync(directory)) fs.renameSync(backup, directory);
      throw error;
    }
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function buildLocalRetrievalIndex(projectRoot: string, options: { embedding_provider?: EmbeddingProvider; built_at?: string } = {}): Promise<RetrievalIndexDescriptor> {
  const root = path.resolve(projectRoot);
  const config = readRetrievalConfig(root);
  const collected = collectRetrievalDocuments(root, config);
  const sourceProjectionDigest = digestValue(collected.documents);
  const provider = options.embedding_provider;
  if (provider && (provider.model !== config.semantic.model || provider.dimensions !== config.semantic.dimensions || !provider.revision || !provider.files_digest)) throw new Error("retrieval_embedding_provider_mismatch");
  if (provider) {
    const allowed = collected.documents.map((document, index) => ({ document, index })).filter(({ document }) => !referenceOnly(document.confidentiality));
    const vectors = await provider.embed(allowed.map(({ document }) => `passage: ${document.search_text}`));
    fail(vectors.length === allowed.length && vectors.every((vector) => vector.length === provider.dimensions && vector.every(Number.isFinite)), "retrieval_embedding_shape_invalid");
    const byIndex = new Map(allowed.map((item, index) => [item.index, vectors[index] as number[]]));
    collected.documents.forEach((document, index) => {
      const { digest: _digest, ...body } = document;
      document.embedding = byIndex.get(index) || Array.from({ length: provider.dimensions }, () => 0);
      document.digest = digestValue({ ...body, embedding: document.embedding });
    });
  }
  const dimensions = provider?.dimensions;
  const database = createDatabase(dimensions);
  if (collected.documents.length) await insertMultiple(database, collected.documents as OramaDocument[]);
  const raw = save(database);
  const directory = retrievalIndexDirectory(root, config.index_id);
  const documentsDigest = digestValue(collected.documents);
  const storageDigest = digestValue(raw);
  const body = {
    contract_version: "1.0.0" as const,
    index_id: config.index_id,
    project_id: config.project_id,
    provider: "orama" as const,
    provider_version: PROVIDER_VERSION,
    access_digest: digestValue(config.access),
    configuration_digest: retrievalConfigurationDigest(config),
    source_snapshot_digests: collected.snapshotDigests,
    graph_snapshot_digest: collected.graph?.digest || null,
    source_projection_digest: sourceProjectionDigest,
    documents_digest: documentsDigest,
    storage_digest: storageDigest,
    document_count: collected.documents.length,
    semantic_status: provider ? "ready" as const : config.semantic.provider === "disabled" ? "disabled" as const : "provider_unavailable" as const,
    semantic_model: provider?.model || config.semantic.model || null,
    semantic_revision: provider?.revision || null,
    semantic_files_digest: provider?.files_digest || null,
    dimensions: dimensions || config.semantic.dimensions || null,
    built_at: options.built_at || new Date().toISOString(),
    canonical_write_allowed: false as const
  };
  const { built_at: _builtAt, ...digestBody } = body;
  const descriptor = { ...body, digest: digestValue(digestBody) };
  const bytes = Buffer.byteLength(JSON.stringify(raw)) + Buffer.byteLength(JSON.stringify(collected.documents));
  fail(bytes <= config.budgets.max_index_bytes, "retrieval_index_byte_budget_exceeded");
  replaceIndexDirectory(directory, { "orama.json": raw, "documents.json": collected.documents, "descriptor.json": descriptor });
  return descriptor;
}

export async function reconcileLocalRetrievalIndex(projectRoot: string, options: { embedding_provider?: EmbeddingProvider; built_at?: string } = {}): Promise<{ descriptor: RetrievalIndexDescriptor; changes: { added: string[]; changed: string[]; removed: string[]; unchanged: string[] } }> {
  const root = path.resolve(projectRoot);
  const config = readRetrievalConfig(root);
  const directory = retrievalIndexDirectory(root, config.index_id);
  const previous = fs.existsSync(path.join(directory, "documents.json")) ? readJson(path.join(directory, "documents.json")) as RetrievalDocument[] : [];
  const current = collectRetrievalDocuments(root, config).documents;
  const old = new Map(previous.map((document) => [document.id, document.digest]));
  const next = new Map(current.map((document) => [document.id, document.digest]));
  const changes = {
    added: current.filter((document) => !old.has(document.id)).map((document) => document.id),
    changed: current.filter((document) => old.has(document.id) && old.get(document.id) !== document.digest).map((document) => document.id),
    removed: previous.filter((document) => !next.has(document.id)).map((document) => document.id),
    unchanged: current.filter((document) => old.get(document.id) === document.digest).map((document) => document.id)
  };
  return { descriptor: await buildLocalRetrievalIndex(root, options), changes };
}

export function inspectLocalRetrievalIndex(projectRoot: string): { status: "ready" | "missing" | "stale" | "invalid"; descriptor?: RetrievalIndexDescriptor; diagnostics: string[] } {
  try {
    const root = path.resolve(projectRoot);
    const config = readRetrievalConfig(root);
    const directory = retrievalIndexDirectory(root, config.index_id);
    const filename = path.join(directory, "descriptor.json");
    if (!fs.existsSync(filename)) return { status: "missing", diagnostics: ["retrieval_index_missing"] };
    const descriptor = readJson(filename) as RetrievalIndexDescriptor;
    const { digest, built_at: _builtAt, ...body } = descriptor;
    if (digestValue(body) !== digest) return { status: "invalid", descriptor, diagnostics: ["retrieval_descriptor_digest_mismatch"] };
    const collected = collectRetrievalDocuments(root, config);
    if (descriptor.storage_digest !== digestValue(readJson(path.join(directory, "orama.json")))) return { status: "invalid", descriptor, diagnostics: ["retrieval_index_storage_digest_mismatch"] };
    if (descriptor.documents_digest !== digestValue(readJson(path.join(directory, "documents.json")))) return { status: "invalid", descriptor, diagnostics: ["retrieval_documents_digest_mismatch"] };
    const stale = descriptor.configuration_digest !== retrievalConfigurationDigest(config) || descriptor.source_projection_digest !== digestValue(collected.documents);
    return stale ? { status: "stale", descriptor, diagnostics: ["retrieval_index_stale"] } : { status: "ready", descriptor, diagnostics: [] };
  } catch (error) {
    return { status: "invalid", diagnostics: [error instanceof Error ? error.message : String(error)] };
  }
}

function freshnessAllowed(document: RetrievalDocument, requirement: RetrievalRequest["freshness_required"]): boolean {
  if (requirement === "allow_stale") return true;
  if (requirement === "allow_aging") return document.freshness !== "stale";
  return document.freshness === "current";
}

function graphExpansion(graph: GraphSnapshot | undefined, seedRefs: string[], documents: RetrievalDocument[], depth: number, maxFanOut: number): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  if (!graph || !seedRefs.length) return paths;
  assertSnapshot(graph);
  let frontier = [...new Set(seedRefs)];
  for (const seed of frontier) paths.set(seed, [seed]);
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next: string[] = [];
    for (const relation of graph.relations) {
      const refs = relation.participants.map((participant) => participant.ref);
      const parent = refs.find((ref) => frontier.includes(ref));
      if (!parent) continue;
      for (const ref of refs) if (!paths.has(ref) && next.length < maxFanOut) { paths.set(ref, [...(paths.get(parent) || [parent]), ref]); next.push(ref); }
    }
    frontier = [...new Set(next)];
  }
  const documentRefs = new Set(documents.flatMap((document) => document.graph_object_refs));
  for (const ref of [...paths.keys()]) if (!documentRefs.has(ref)) paths.delete(ref);
  return paths;
}

function graphQuerySeeds(graph: GraphSnapshot | undefined, query: string): string[] {
  if (!graph) return [];
  const terms = query.toLocaleLowerCase("und").split(/[^\p{L}\p{N}_.:-]+/u).filter((item) => item.length > 2);
  const ranked = graph.objects.map((object) => {
    const searchable = `${object.id} ${object.kind} ${JSON.stringify(object.metadata)}`.toLocaleLowerCase("und");
    return { id: object.id, score: terms.filter((term) => searchable.includes(term)).length };
  }).filter((item) => item.score > 0);
  const best = Math.max(0, ...ranked.map((item) => item.score));
  return ranked.filter((item) => item.score === best).map((item) => item.id);
}

function entityKey(documentId: string): string {
  return documentId.replace(/^(?:graph\.object:|graph\.relation:|policy:|program:|evidence:|unit\.)/u, "");
}

function normalizedQuery(value: string): string {
  const trimmed = value.trim();
  const unquoted = ((trimmed.startsWith("`") && trimmed.endsWith("`")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  return unquoted.toLocaleLowerCase("und");
}

function queryTerms(value: string): string[] {
  return [...new Set(normalizedQuery(value).split(/[^\p{L}\p{N}_.:-]+/u).filter((item) => item.length > 2))];
}

function queryAwareBoost(document: RetrievalDocument, request: RetrievalRequest, plan: ReturnType<typeof planRetrieval>): number {
  const query = normalizedQuery(request.query);
  const identityValues = [document.id, entityKey(document.id), document.title].map((item) => item.toLocaleLowerCase("und"));
  if (identityValues.includes(query)) return 4;
  const terms = queryTerms(request.query);
  const searchable = `${document.id} ${document.title} ${document.search_text}`.toLocaleLowerCase("und");
  const overlap = terms.length ? terms.filter((term) => searchable.includes(term)).length / terms.length : 0;
  const kind = document.kind.toLocaleLowerCase("und");
  const intentBoost = plan.intent === "relationship_trace" && kind.includes("relation") ? 0.4
    : plan.intent === "policy_lookup" && (kind.includes("policy") || /gate|capability|decision.right/u.test(kind)) ? 0.4
      : plan.intent === "technology_lookup" && (document.program_refs.length > 0 || /technology|program|process|workflow/u.test(kind)) ? 0.4
        : plan.intent === "evidence_lookup" && /evidence|result|review|test|conformance/u.test(kind) ? 0.4
          : 0;
  return overlap * 1.5 + intentBoost;
}

export async function searchLocalRetrievalIndex(projectRoot: string, request: RetrievalRequest, options: { embedding_provider?: EmbeddingProvider } = {}): Promise<{ plan: ReturnType<typeof planRetrieval>; evidence: EvidenceBundle; answer: ReturnType<typeof createRetrievalAnswer> }> {
  const root = path.resolve(projectRoot);
  const config = readRetrievalConfig(root);
  const descriptorFile = path.join(retrievalIndexDirectory(root, config.index_id), "descriptor.json");
  if (!fs.existsSync(descriptorFile)) throw new Error("retrieval_index_not_ready:missing:retrieval_index_missing");
  const projectedDescriptor = readJson(descriptorFile) as RetrievalIndexDescriptor;
  if (digestValue(request.access) !== projectedDescriptor.access_digest) throw new Error("retrieval_access_projection_mismatch");
  const state = inspectLocalRetrievalIndex(root);
  if (state.status !== "ready" || !state.descriptor) throw new Error(`retrieval_index_not_ready:${state.status}:${state.diagnostics.join(",")}`);
  const descriptor = state.descriptor;
  if (request.graph && request.graph.digest !== descriptor.graph_snapshot_digest) throw new Error("retrieval_graph_snapshot_mismatch");
  if (!request.graph && descriptor.graph_snapshot_digest) throw new Error("retrieval_graph_snapshot_required");
  const plan = planRetrieval(request, descriptor, config);
  const deadline = Date.now() + plan.budgets.timeout_ms;
  const assertDeadline = (): void => fail(Date.now() <= deadline, "retrieval_timeout_exceeded");
  const directory = retrievalIndexDirectory(root, config.index_id);
  const documents = readJson(path.join(directory, "documents.json")) as RetrievalDocument[];
  const accessPermitted = documents.filter((document) => request.access.source_refs.includes(document.source_ref) && request.access.scopes.includes(document.scope) && (!request.access.document_ids || request.access.document_ids.includes(document.id)));
  if (accessPermitted.length !== documents.length) throw new Error("retrieval_runtime_access_differs_from_index_projection");
  const permitted = accessPermitted.filter((document) => freshnessAllowed(document, request.freshness_required));
  const database = createDatabase(descriptor.semantic_status === "ready" ? descriptor.dimensions || undefined : undefined);
  load(database, readJson(path.join(directory, "orama.json")) as RawData);
  const rankings: Array<{ channel: RetrievalChannel; ids: string[] }> = [];
  const reasons = new Map<string, string[]>();
  const normalized = normalizedQuery(request.query);
  if (plan.channels.includes("exact")) {
    const ids = permitted.filter((document) => [document.id, document.title, document.source_ref].some((value) => value.toLocaleLowerCase("und").includes(normalized))).map((document) => document.id);
    rankings.push({ channel: "exact", ids });
    ids.forEach((id) => reasons.set(id, [...(reasons.get(id) || []), "exact_identifier_or_title_match"]));
  }
  if (plan.channels.includes("lexical")) {
    const result = await search(database, { term: request.query, properties: ["title", "search_text", "source_ref"], limit: Math.max(plan.budgets.max_results * 4, 20) });
    assertDeadline();
    const ids = result.hits.map((hit) => String((hit.document as OramaDocument).id));
    rankings.push({ channel: "lexical", ids });
    ids.forEach((id) => reasons.set(id, [...(reasons.get(id) || []), "bm25_lexical_match"]));
  }
  if (plan.channels.includes("semantic")) {
    const provider = options.embedding_provider;
    if (!provider || provider.model !== descriptor.semantic_model || provider.dimensions !== descriptor.dimensions) throw new Error("retrieval_semantic_provider_required");
    if ((provider.revision || null) !== descriptor.semantic_revision || (provider.files_digest || null) !== descriptor.semantic_files_digest) throw new Error("retrieval_semantic_artifact_binding_mismatch");
    const remaining = deadline - Date.now();
    fail(remaining > 0, "retrieval_timeout_exceeded");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const [vector] = await Promise.race([
      provider.embed([`query: ${request.query}`]),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("retrieval_timeout_exceeded")), remaining); })
    ]).finally(() => { if (timer) clearTimeout(timer); });
    assertDeadline();
    fail(vector && vector.length === provider.dimensions && vector.every(Number.isFinite), "retrieval_query_embedding_invalid");
    const result = await search(database, { mode: "vector", vector: { value: vector, property: "embedding" }, limit: Math.max(plan.budgets.max_results * 4, 20) });
    const semanticAllowed = new Set(permitted.filter((document) => !referenceOnly(document.confidentiality)).map((document) => document.id));
    const ids = result.hits.map((hit) => String((hit.document as OramaDocument).id)).filter((id) => semanticAllowed.has(id));
    rankings.push({ channel: "semantic", ids });
    ids.forEach((id) => reasons.set(id, [...(reasons.get(id) || []), "semantic_vector_match"]));
  }
  if (plan.channels.includes("process")) {
    const terms = normalized.split(/[^\p{L}\p{N}_.:-]+/u).filter((item) => item.length > 2);
    const ids = permitted.filter((document) => {
      const processLike = document.program_refs.length || document.policy_refs.length || /technology|program|policy|gate|process/u.test(document.kind);
      const searchable = `${document.id} ${document.title} ${document.search_text}`.toLocaleLowerCase("und");
      return Boolean(processLike) && terms.some((term) => searchable.includes(term));
    }).map((document) => document.id);
    rankings.push({ channel: "process", ids });
    ids.forEach((id) => reasons.set(id, [...(reasons.get(id) || []), "governed_process_or_policy_candidate"]));
  }
  const graphSeeds = [...new Set(graphQuerySeeds(request.graph, request.query))];
  const paths = plan.channels.includes("graph") ? graphExpansion(request.graph, graphSeeds, permitted, plan.budgets.max_graph_depth, plan.budgets.max_fan_out) : new Map<string, string[]>();
  const graphIds = permitted.filter((document) => document.graph_object_refs.some((ref) => paths.has(ref))).map((document) => document.id);
  if (graphIds.length) rankings.push({ channel: "graph", ids: graphIds });
  const fused = reciprocalRankFusion(rankings);
  const entityScores = new Map<string, number>();
  for (const document of permitted) {
    const score = fused.get(document.id)?.score;
    if (score !== undefined) entityScores.set(entityKey(document.id), Math.max(entityScores.get(entityKey(document.id)) || 0, score));
  }
  for (const document of permitted) {
    const companionScore = entityScores.get(entityKey(document.id));
    if (companionScore === undefined || document.id.startsWith("graph.")) continue;
    const existing = fused.get(document.id);
    fused.set(document.id, { score: Math.max(existing?.score || 0, companionScore + 1 / 40), channels: [...new Set([...(existing?.channels || []), "graph" as const])] });
    reasons.set(document.id, [...new Set([...(reasons.get(document.id) || []), "graph_entity_companion"])]);
  }
  if (plan.intent === "change_or_freshness") {
    const selectedKeys = new Set(permitted.filter((document) => fused.has(document.id)).map((document) => entityKey(document.id)));
    for (const document of permitted) if (selectedKeys.has(entityKey(document.id)) && (document.freshness === "stale" || document.conflict_refs?.length) && !fused.has(document.id)) {
      fused.set(document.id, { score: 1 / 80, channels: ["process"] });
      reasons.set(document.id, ["entity_state_companion"]);
    }
  }
  const conflictRequested = /(?:conflict|конфликт)/iu.test(request.query);
  if (conflictRequested) {
    for (const document of permitted.filter((item) => item.conflict_refs?.length)) {
      if (!fused.has(document.id)) fused.set(document.id, { score: 1 / 120, channels: ["process"] });
      reasons.set(document.id, [...new Set([...(reasons.get(document.id) || []), "explicit_conflict_candidate"])]);
    }
  }
  const hits = sortHits(permitted.filter((document) => fused.has(document.id)).map((document): RetrievalHit => {
    const score = fused.get(document.id) as { score: number; channels: RetrievalChannel[] };
    const graphPath = document.graph_object_refs.map((ref) => paths.get(ref)).find(Boolean);
    return {
      document_id: document.id, kind: document.kind, title: document.title, snippet: document.snippet, source_ref: document.source_ref, scope: document.scope,
      authority: document.authority, freshness: document.freshness, graph_object_refs: document.graph_object_refs, evidence_refs: document.evidence_refs,
      program_refs: document.program_refs, policy_refs: document.policy_refs, channels: score.channels,
      rank_score: score.score + (plan.intent === "relationship_trace" && graphPath && graphPath.length > 1 ? 1 : 0) + queryAwareBoost(document, request, plan),
      ...(document.conflict_refs?.length ? { conflict_refs: document.conflict_refs } : {}),
      match_reasons: [...new Set([...(reasons.get(document.id) || []), ...(graphPath ? ["bounded_graph_path"] : [])])], ...(graphPath ? { graph_path: graphPath } : {})
      , instructions_authorized: false as const, canonical_write_allowed: false as const
    };
  })).slice(0, plan.budgets.max_results);
  const conflicts = [...new Set([
    ...hits.filter((hit) => hit.freshness === "stale").map((hit) => `stale:${hit.document_id}`),
    ...(conflictRequested ? hits.flatMap((hit) => (hit.conflict_refs || []).map((ref) => `conflict:${hit.document_id}:${ref}`)) : [])
  ])];
  const limitations = [...plan.diagnostics, ...(request.graph ? [] : ["graph_snapshot_not_supplied"]), ...(descriptor.semantic_status === "ready" ? [] : ["semantic_retrieval_unavailable"])];
  const evidenceBody = {
    contract_version: "1.0.0" as const, query_digest: plan.request_digest, index_digest: descriptor.digest, graph_digest: request.graph?.digest || null,
    policy_digest: request.access.policy_digest, hits, source_refs: [...new Set(hits.map((hit) => hit.source_ref))].sort(), conflicts, limitations,
    partial: limitations.some((item) => item.includes("unavailable")), instructions_authorized: false as const, canonical_write_allowed: false as const
  };
  const evidence = { ...evidenceBody, digest: digestValue(evidenceBody) };
  const answer = createRetrievalAnswer(request, plan, evidence);
  assertDeadline();
  return { plan, evidence, answer };
}
