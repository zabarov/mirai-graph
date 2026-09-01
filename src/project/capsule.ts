import fs from "node:fs";
import path from "node:path";
import { parseDocument, stringify } from "yaml";
import { canonicalize, digestValue, sha256 } from "../core/index.js";
import type { AgentExecutionBrief, MiraiProjectLock, MiraiProjectManifest, ProjectDetectionResult, ProjectKind } from "./types.js";

export const CAPSULE_DIR = "mirai";
export const MANIFEST_PATH = "mirai/manifest.yaml";
export const LOCK_PATH = "mirai/manifest.lock.json";
export const START_PATH = "mirai/START.md";

const FORBIDDEN_MANIFEST_KEYS = new Set([
  "approval", "approvals", "approval_receipt", "capability", "capabilities",
  "capability_grant", "capability_grants", "canonical_write_allowed"
]);

function assertInside(root: string, relative: string): string {
  if (!relative || path.isAbsolute(relative)) throw new Error(`unsafe_project_path:${relative}`);
  const normalized = path.normalize(relative).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) throw new Error(`unsafe_project_path:${relative}`);
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`path_escape:${relative}`);
  return target;
}

function assertNoAuthorityKeys(value: unknown, pointer = "manifest"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAuthorityKeys(item, `${pointer}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_MANIFEST_KEYS.has(key)) throw new Error(`manifest_cannot_mint_authority:${pointer}.${key}`);
    assertNoAuthorityKeys(child, `${pointer}.${key}`);
  }
}

function parseYamlObject(filename: string): Record<string, unknown> {
  const source = fs.readFileSync(filename, "utf8");
  if (/(^|[\s\[{,])[&*][A-Za-z0-9_-]+/m.test(source)) throw new Error(`yaml_aliases_not_allowed:${filename}`);
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new Error(`invalid_yaml:${document.errors.map((item) => item.message).join(";")}`);
  const value = document.toJS({ maxAliasCount: 0 }) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`yaml_root_must_be_object:${filename}`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing_or_invalid:${label}`);
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) throw new Error(`missing_or_invalid:${label}`);
  return [...new Set(value as string[])];
}

export function validateProjectManifest(value: unknown, projectRoot?: string): MiraiProjectManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("manifest_must_be_object");
  assertNoAuthorityKeys(value);
  const record = value as Record<string, unknown>;
  if (record.contract_version !== "1.0.0") throw new Error("unsupported_project_manifest_contract");
  const project = record.project as Record<string, unknown>;
  const requires = record.requires as Record<string, unknown>;
  const entrypoints = record.entrypoints as Record<string, unknown>;
  const graph = entrypoints?.graph as Record<string, unknown>;
  const boundaries = record.boundaries as Record<string, unknown>;
  const documentation = record.documentation as Record<string, unknown>;
  const compatibility = record.compatibility as Record<string, unknown>;
  const kind = asString(project?.kind, "project.kind") as ProjectKind;
  if (!["project", "organization", "ai_system", "research_program", "software_system"].includes(kind)) throw new Error(`invalid_project_kind:${kind}`);
  if (boundaries?.source_of_truth !== "hybrid_sot" || boundaries?.canonical_writes !== "owner_approval_required" || boundaries?.generated_authority !== false || boundaries?.evidence_authority !== false) throw new Error("unsafe_or_missing_project_boundaries");
  if (!compatibility || !["required_2_x", "disabled"].includes(String(compatibility.legacy_facade))) throw new Error("invalid_legacy_facade_policy");
  const manifest: MiraiProjectManifest = {
    contract_version: "1.0.0",
    project: { id: asString(project?.id, "project.id"), title: asString(project?.title, "project.title"), kind, scope: asString(project?.scope, "project.scope"), owner: asString(project?.owner, "project.owner") },
    requires: { mirai: asString(requires?.mirai, "requires.mirai"), graph_contract: asString(requires?.graph_contract, "requires.graph_contract"), program_contract: asString(requires?.program_contract, "requires.program_contract"), runtime_contract: asString(requires?.runtime_contract, "requires.runtime_contract") },
    profiles: asStringArray(record.profiles, "profiles"),
    entrypoints: {
      graph: { root: asString(graph?.root, "entrypoints.graph.root"), objects: asStringArray(graph?.objects, "entrypoints.graph.objects"), relations: asStringArray(graph?.relations, "entrypoints.graph.relations") },
      ...(entrypoints?.programs ? { programs: asString(entrypoints.programs, "entrypoints.programs") } : {}),
      ...(entrypoints?.components ? { components: asString(entrypoints.components, "entrypoints.components") } : {}),
      ...(entrypoints?.policies ? { policies: asString(entrypoints.policies, "entrypoints.policies") } : {}),
      ...(entrypoints?.interfaces ? { interfaces: asString(entrypoints.interfaces, "entrypoints.interfaces") } : {}),
      ...(entrypoints?.context ? { context: asString(entrypoints.context, "entrypoints.context") } : {}),
      sources: asString(entrypoints?.sources, "entrypoints.sources")
    },
    features: asStringArray(record.features, "features"),
    boundaries: { source_of_truth: "hybrid_sot", canonical_writes: "owner_approval_required", generated_authority: false, evidence_authority: false },
    documentation: { start: asString(documentation?.start, "documentation.start"), owner_notes: asString(documentation?.owner_notes, "documentation.owner_notes") },
    compatibility: { legacy_facade: compatibility.legacy_facade as "required_2_x" | "disabled" }
  };
  if (projectRoot) {
    for (const relative of projectEntrypointPaths(manifest)) assertInside(projectRoot, relative);
    assertInside(projectRoot, manifest.documentation.start);
    assertInside(projectRoot, manifest.documentation.owner_notes);
  }
  return canonicalize(manifest) as MiraiProjectManifest;
}

export function readProjectManifest(projectRoot: string): MiraiProjectManifest {
  const root = path.resolve(projectRoot);
  return validateProjectManifest(parseYamlObject(path.join(root, MANIFEST_PATH)), root);
}

function projectEntrypointPaths(manifest: MiraiProjectManifest): string[] {
  const paths = [manifest.entrypoints.graph.root, ...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations, manifest.entrypoints.sources];
  for (const key of ["programs", "components", "policies", "interfaces", "context"] as const) if (manifest.entrypoints[key]) paths.push(manifest.entrypoints[key] as string);
  return [...new Set(paths)];
}

function digestPath(projectRoot: string, relative: string): string {
  const target = assertInside(projectRoot, relative);
  if (!fs.existsSync(target)) return digestValue({ missing: relative });
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`symlink_entrypoint_not_allowed:${relative}`);
  if (stat.isFile()) return sha256(fs.readFileSync(target));
  if (!stat.isDirectory()) throw new Error(`unsupported_entrypoint_type:${relative}`);
  const entries: Array<{ path: string; digest: string }> = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir).sort()) {
      const absolute = path.join(dir, name);
      const item = fs.lstatSync(absolute);
      const itemRelative = path.relative(projectRoot, absolute).replaceAll(path.sep, "/");
      if (item.isSymbolicLink()) throw new Error(`symlink_entrypoint_not_allowed:${itemRelative}`);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile()) entries.push({ path: itemRelative, digest: sha256(fs.readFileSync(absolute)) });
    }
  };
  walk(target);
  return digestValue(entries);
}

function semanticSourceDigest(projectRoot: string, relative: string): string {
  const target = assertInside(projectRoot, relative);
  if (!fs.existsSync(target)) return digestValue({ missing: relative });
  return digestValue(parseYamlObject(target));
}

export function createProjectLock(projectRoot: string, manifest = readProjectManifest(projectRoot)): MiraiProjectLock {
  const root = path.resolve(projectRoot);
  for (const required of [...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations, manifest.entrypoints.sources]) {
    if (!fs.existsSync(assertInside(root, required))) throw new Error(`required_entrypoint_missing:${required}`);
  }
  const entrypointDigests = Object.fromEntries(projectEntrypointPaths(manifest).sort().map((relative) => [relative, relative === manifest.entrypoints.sources ? semanticSourceDigest(root, relative) : digestPath(root, relative)]));
  const draft = {
    contract_version: "1.0.0" as const,
    manifest,
    resolved_contracts: manifest.requires,
    entrypoint_digests: entrypointDigests,
    source_reference_digest: semanticSourceDigest(root, manifest.entrypoints.sources),
    canonical_write_allowed: false as const
  };
  return { ...draft, digest: digestValue(draft) };
}

export function generateProjectStart(lock: MiraiProjectLock, ownerNotes: string): string {
  const manifest = lock.manifest;
  const note = ownerNotes.trim();
  return [
    "<!-- GENERATED BY MIRAI. Edit mirai/owner-notes.md, then run `mirai project compile`. -->",
    `# ${manifest.project.title}`,
    "",
    `- Project: \`${manifest.project.id}\``,
    `- Kind: \`${manifest.project.kind}\``,
    `- Mirai: \`${manifest.requires.mirai}\``,
    `- Project manifest contract: \`${manifest.contract_version}\``,
    `- Lock digest: \`${lock.digest}\``,
    `- Profiles: ${manifest.profiles.map((item) => `\`${item}\``).join(", ")}`,
    "",
    "## Boundaries",
    "",
    "Mirai uses Hybrid SOT. Generated context and evidence do not authorize canonical updates. Canonical writes require owner approval. Runtime must use the verified lock, not mutable YAML.",
    "",
    "## Entry Points",
    "",
    ...projectEntrypointPaths(manifest).map((item) => `- \`${item}\``),
    ...(note ? ["", "## Owner Notes", "", note] : []),
    ""
  ].join("\n");
}

export function compileProjectCapsule(projectRoot: string): { lock: MiraiProjectLock; start: string; lock_path: string; start_path: string } {
  const root = path.resolve(projectRoot);
  const manifest = readProjectManifest(root);
  const portableDirectories = [
    manifest.entrypoints.programs,
    manifest.entrypoints.components,
    manifest.entrypoints.policies,
    manifest.entrypoints.interfaces,
    manifest.entrypoints.context,
    "mirai/migrations",
    "mirai/proposals"
  ].filter((item): item is string => Boolean(item));
  for (const relative of portableDirectories) {
    const directory = assertInside(root, relative);
    fs.mkdirSync(directory, { recursive: true });
    const marker = path.join(directory, ".gitkeep");
    if (!fs.existsSync(marker)) fs.writeFileSync(marker, "", { mode: 0o644 });
  }
  const lock = createProjectLock(root, manifest);
  const notesPath = assertInside(root, manifest.documentation.owner_notes);
  const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, "utf8") : "";
  const start = generateProjectStart(lock, notes);
  const lockPath = assertInside(root, LOCK_PATH);
  const startPath = assertInside(root, manifest.documentation.start);
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, { mode: 0o644 });
  fs.writeFileSync(startPath, start, { mode: 0o644 });
  return { lock, start, lock_path: lockPath, start_path: startPath };
}

export function validateProjectCapsule(projectRoot: string): { valid: boolean; status: ProjectDetectionResult["status"]; errors: string[]; lock?: MiraiProjectLock } {
  const root = path.resolve(projectRoot);
  try {
    const expected = createProjectLock(root);
    const lockPath = path.join(root, LOCK_PATH);
    if (!fs.existsSync(lockPath)) return { valid: false, status: "needs_compile", errors: ["missing_manifest_lock"] };
    const actual = JSON.parse(fs.readFileSync(lockPath, "utf8")) as MiraiProjectLock;
    const errors: string[] = [];
    const { digest: actualDigest, ...actualBody } = actual;
    if (actualDigest !== expected.digest || digestValue(actualBody) !== actualDigest) errors.push("stale_or_invalid_manifest_lock");
    const notesPath = path.join(root, expected.manifest.documentation.owner_notes);
    const expectedStart = generateProjectStart(expected, fs.existsSync(notesPath) ? fs.readFileSync(notesPath, "utf8") : "");
    const startPath = path.join(root, expected.manifest.documentation.start);
    if (!fs.existsSync(startPath) || fs.readFileSync(startPath, "utf8") !== expectedStart) errors.push("stale_or_modified_generated_start");
    return errors.length ? { valid: false, status: "needs_compile", errors } : { valid: true, status: "current", errors: [], lock: actual };
  } catch (error) {
    return { valid: false, status: "invalid", errors: [error instanceof Error ? error.message : String(error)] };
  }
}

function readLegacyFacade(projectRoot: string): Record<string, unknown> | null {
  const filename = path.join(projectRoot, "graph.json");
  if (!fs.existsSync(filename)) return null;
  try { return JSON.parse(fs.readFileSync(filename, "utf8")) as Record<string, unknown>; } catch { return { invalid: true }; }
}

function facadeMatches(manifest: MiraiProjectManifest, facade: Record<string, unknown>): boolean {
  const graph = facade.graph as Record<string, unknown> | undefined;
  return facade.id === manifest.project.id && graph?.root === manifest.entrypoints.graph.root;
}

export function detectProjectCapsule(projectRoot: string): ProjectDetectionResult {
  const root = path.resolve(projectRoot);
  const hasManifest = fs.existsSync(path.join(root, MANIFEST_PATH));
  const facade = readLegacyFacade(root);
  const legacyLayout = Boolean(facade) || fs.existsSync(path.join(root, "graph"));
  if (!hasManifest) return { contract_version: "1.0.0", target_dir: root, status: legacyLayout ? "legacy_detected" : "bootstrap_proposal", project_id: typeof facade?.id === "string" ? facade.id : null, lock_fresh: false, legacy_layout: legacyLayout, blockers: [], canonical_write_allowed: false, next_safe_action: legacyLayout ? "mirai project migrate . --from graph-v2 --dry-run" : "mirai project init . --profile project_management" };
  try {
    const manifest = readProjectManifest(root);
    if (facade && !facadeMatches(manifest, facade)) return { contract_version: "1.0.0", target_dir: root, status: "dual_root_conflict", project_id: manifest.project.id, lock_fresh: false, legacy_layout: true, blockers: ["incompatible_root_graph_facade"], canonical_write_allowed: false, next_safe_action: "resolve_dual_root_conflict" };
    const validation = validateProjectCapsule(root);
    return { contract_version: "1.0.0", target_dir: root, status: validation.status, project_id: manifest.project.id, lock_fresh: validation.valid, legacy_layout: Boolean(facade), blockers: validation.errors, canonical_write_allowed: false, next_safe_action: validation.valid ? "mirai project inspect . --for-agent --task <task>" : "mirai project compile ." };
  } catch (error) {
    return { contract_version: "1.0.0", target_dir: root, status: "invalid", project_id: null, lock_fresh: false, legacy_layout: legacyLayout, blockers: [error instanceof Error ? error.message : String(error)], canonical_write_allowed: false, next_safe_action: "repair_project_manifest" };
  }
}

function listFiles(projectRoot: string, relative: string | undefined, suffix?: string): string[] {
  if (!relative) return [];
  const target = assertInside(projectRoot, relative);
  if (!fs.existsSync(target)) return [];
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return !suffix || relative.endsWith(suffix) ? [relative] : [];
  return fs.readdirSync(target).sort().filter((name) => !name.startsWith(".")).flatMap((name) => listFiles(projectRoot, path.posix.join(relative, name), suffix));
}

export function inspectProjectForAgent(projectRoot: string, task: string): AgentExecutionBrief {
  const validation = validateProjectCapsule(projectRoot);
  if (!validation.valid || !validation.lock) throw new Error(`project_execution_blocked:${validation.errors.join(",")}`);
  const manifest = validation.lock.manifest;
  const requiredSources = [manifest.entrypoints.sources, ...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations];
  const draft = {
    contract_version: "1.0.0" as const,
    project: manifest.project,
    task,
    versions: manifest.requires,
    lock: { digest: validation.lock.digest, fresh: true as const },
    profiles: manifest.profiles,
    features: manifest.features,
    required_sources: requiredSources,
    available_programs: listFiles(path.resolve(projectRoot), manifest.entrypoints.programs, ".mirai.json"),
    policies_and_gates: listFiles(path.resolve(projectRoot), manifest.entrypoints.policies),
    allowed_actions: ["read_declared_sources", "validate_capsule", "simulate_program", "prepare_proposal"],
    forbidden_actions: ["mint_capability", "self_approve", "canonical_write_without_owner_approval", "treat_generated_or_evidence_as_authority"],
    missing_context: task.trim() ? [] : ["task"],
    blockers: [] as string[],
    next_safe_action: task.trim() ? "resolve_task_scoped_context_and_select_governed_process" : "provide_task",
    canonical_write_allowed: false as const
  };
  return { ...draft, digest: digestValue(draft) };
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "project.local";
}

export function createLegacyFacade(manifest: MiraiProjectManifest, legacy?: Record<string, unknown>): Record<string, unknown> {
  return {
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json",
    format: "mirai-graph",
    schema_version: "2.0.0",
    id: manifest.project.id,
    aliases: [],
    title: manifest.project.title,
    scope: "repository",
    kind: "project_graph",
    owner: manifest.project.owner,
    profiles: manifest.profiles,
    graph: { root: manifest.entrypoints.graph.root, source_of_truth: [manifest.entrypoints.graph.root], objects: manifest.entrypoints.graph.objects, relations: manifest.entrypoints.graph.relations, schemas: [], generated: [], raw_sources: [manifest.entrypoints.sources] },
    imports: [],
    ...(legacy?.extensions && typeof legacy.extensions === "object" ? { extensions: legacy.extensions } : {})
  };
}

export function initProjectCapsule(projectRoot: string, profile = "project_management", options: { title?: string; force?: boolean } = {}): { status: string; project_root: string; files_created: string[]; lock_digest: string; canonical_write_allowed: false } {
  const root = path.resolve(projectRoot);
  const capsule = path.join(root, CAPSULE_DIR);
  if (fs.existsSync(capsule) && !options.force) throw new Error("project_capsule_exists");
  if (fs.existsSync(capsule) && options.force) throw new Error("force_does_not_overwrite_existing_capsule");
  const title = options.title || path.basename(root) || "Mirai Project";
  const id = `project.${slug(title)}`;
  for (const dir of ["graph", "programs", "components", "policies", "interfaces", "context", "migrations", "proposals"]) fs.mkdirSync(path.join(capsule, dir), { recursive: true });
  const manifest: MiraiProjectManifest = {
    contract_version: "1.0.0",
    project: { id, title, kind: "project", scope: "repository", owner: "repository_owner" },
    requires: { mirai: ">=2.1.0-alpha <3.0.0", graph_contract: "2.0.0", program_contract: "1.0.0", runtime_contract: "1.0.0" },
    profiles: [profile],
    entrypoints: { graph: { root: "mirai/graph", objects: ["mirai/graph/objects.json"], relations: ["mirai/graph/relations.json"] }, programs: "mirai/programs", components: "mirai/components", policies: "mirai/policies", interfaces: "mirai/interfaces", context: "mirai/context", sources: "mirai/sources.yaml" },
    features: ["project_self_description", "graph_core", "proposal_first_learning"],
    boundaries: { source_of_truth: "hybrid_sot", canonical_writes: "owner_approval_required", generated_authority: false, evidence_authority: false },
    documentation: { start: "mirai/START.md", owner_notes: "mirai/owner-notes.md" },
    compatibility: { legacy_facade: "required_2_x" }
  };
  fs.writeFileSync(path.join(root, MANIFEST_PATH), stringify(manifest, { sortMapEntries: true }), "utf8");
  fs.writeFileSync(path.join(capsule, "owner-notes.md"), `# Owner Notes\n\n${title} uses Mirai as a governed project capsule.\n`, "utf8");
  fs.writeFileSync(path.join(capsule, "sources.yaml"), stringify({ contract_version: "1.0.0", sources: [{ id: "source.project_readme", ref: "README.md", authority: "owner_source", scope: "project", freshness: "task_boundary", confidentiality: "project_internal" }] }, { sortMapEntries: true }), "utf8");
  fs.writeFileSync(path.join(capsule, "graph", "objects.json"), "[]\n", "utf8");
  fs.writeFileSync(path.join(capsule, "graph", "relations.json"), "[]\n", "utf8");
  fs.writeFileSync(path.join(root, "graph.json"), `${JSON.stringify(createLegacyFacade(manifest), null, 2)}\n`, "utf8");
  const ignorePath = path.join(root, ".gitignore");
  const ignore = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, "utf8") : "";
  if (!ignore.split(/\r?\n/).includes(".mirai/")) fs.appendFileSync(ignorePath, `${ignore && !ignore.endsWith("\n") ? "\n" : ""}.mirai/\n`, "utf8");
  const compiled = compileProjectCapsule(root);
  return { status: "created", project_root: root, files_created: [MANIFEST_PATH, LOCK_PATH, START_PATH, "mirai/owner-notes.md", "mirai/sources.yaml", "mirai/graph/objects.json", "mirai/graph/relations.json", "graph.json"], lock_digest: compiled.lock.digest, canonical_write_allowed: false };
}

export function createBootstrapProposal(projectRoot: string, profile = "project_management"): { status: string; proposal_ref: string; recommended_profile: string; canonical_write_allowed: false; next_safe_action: string } {
  const root = path.resolve(projectRoot);
  const detection = detectProjectCapsule(root);
  const outputDir = path.join(root, ".mirai", "proposals");
  fs.mkdirSync(outputDir, { recursive: true });
  const proposal = {
    contract_version: "1.0.0",
    kind: "mirai_project_bootstrap_proposal",
    project_ref: path.basename(root),
    detection_status: detection.status,
    recommended_profile: profile,
    proposed_layout: "mirai/",
    source_boundary: "hybrid_sot",
    canonical_write_allowed: false,
    next_safe_action: `review proposal, then run mirai project init . --profile ${profile}`
  };
  const filename = path.join(outputDir, "bootstrap-proposal.json");
  fs.writeFileSync(filename, `${JSON.stringify({ ...proposal, digest: digestValue(proposal) }, null, 2)}\n`, "utf8");
  return { status: "proposal_written", proposal_ref: path.relative(root, filename).replaceAll(path.sep, "/"), recommended_profile: profile, canonical_write_allowed: false, next_safe_action: proposal.next_safe_action };
}
