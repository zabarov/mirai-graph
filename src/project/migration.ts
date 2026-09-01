import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { digestValue, sha256 } from "../core/index.js";
import { compileProjectCapsule, createLegacyFacade, detectProjectCapsule, readProjectManifest, validateProjectCapsule } from "./capsule.js";
import type { MiraiProjectManifest, ProjectMigrationResult } from "./types.js";

interface MigrationApproval {
  approval_id: string;
  action: "mirai_project_migration" | "mirai_project_migration_rollback";
  project_root: string;
  approved: true;
  expires_at: string;
}

function inventoryDirectory(root: string, relative: string): Array<{ path: string; digest: string }> {
  const base = path.join(root, relative);
  if (!fs.existsSync(base)) return [];
  const result: Array<{ path: string; digest: string }> = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir).sort()) {
      const absolute = path.join(dir, name);
      const stat = fs.lstatSync(absolute);
      const item = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (stat.isSymbolicLink()) throw new Error(`migration_symlink_not_allowed:${item}`);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) result.push({ path: item, digest: sha256(fs.readFileSync(absolute)) });
    }
  };
  walk(base);
  return result;
}

function readLegacyManifest(root: string): Record<string, unknown> {
  const filename = path.join(root, "graph.json");
  if (!fs.existsSync(filename)) throw new Error("legacy_graph_manifest_missing");
  const value = JSON.parse(fs.readFileSync(filename, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("legacy_graph_manifest_invalid");
  return value as Record<string, unknown>;
}

function legacyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function mapGraphPath(value: string): string {
  if (value === "graph") return "mirai/graph";
  return value.startsWith("graph/") ? `mirai/${value}` : value;
}

const NON_PORTABLE_LEGACY_PREFIXES = [
  "graph/generated/",
  "graph/database/",
  "graph/source/raw/"
] as const;

function isNonPortableLegacyPath(value: string): boolean {
  return NON_PORTABLE_LEGACY_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function migratedManifest(root: string, legacy: Record<string, unknown>): MiraiProjectManifest {
  const graph = legacy.graph as Record<string, unknown> | undefined;
  const mapList = (value: unknown, fallback: string[]): string[] => Array.isArray(value) && value.every((item) => typeof item === "string") ? (value as string[]).map(mapGraphPath) : fallback;
  const profiles = Array.isArray(legacy.profiles) && legacy.profiles.every((item) => typeof item === "string") ? legacy.profiles as string[] : ["project_management"];
  return {
    contract_version: "1.0.0",
    project: {
      id: legacyString(legacy.id, `project.${path.basename(root)}`),
      title: legacyString(legacy.title, path.basename(root)),
      kind: "project",
      scope: legacyString(legacy.scope, "repository"),
      owner: legacyString(legacy.owner, "repository_owner")
    },
    requires: { mirai: ">=2.1.0-alpha <3.0.0", graph_contract: legacyString(legacy.schema_version, "2.0.0"), program_contract: "1.0.0", runtime_contract: "1.0.0" },
    profiles,
    entrypoints: {
      graph: {
        root: mapGraphPath(legacyString(graph?.root, "graph")),
        objects: mapList(graph?.objects, ["mirai/graph/objects.json"]),
        relations: mapList(graph?.relations, ["mirai/graph/relations.json"])
      },
      programs: "mirai/programs",
      components: "mirai/components",
      policies: "mirai/policies",
      interfaces: "mirai/interfaces",
      context: "mirai/context",
      sources: "mirai/sources.yaml"
    },
    features: ["project_self_description", "graph_core", "proposal_first_learning", "legacy_graph_v2_compatibility"],
    boundaries: { source_of_truth: "hybrid_sot", canonical_writes: "owner_approval_required", generated_authority: false, evidence_authority: false },
    documentation: { start: "mirai/START.md", owner_notes: "mirai/owner-notes.md" },
    compatibility: { legacy_facade: "required_2_x" }
  };
}

export function migratedSourceCatalog(legacy: Record<string, unknown>): Record<string, unknown> {
  const graph = legacy.graph as Record<string, unknown> | undefined;
  const refs = Array.isArray(graph?.raw_sources) ? graph.raw_sources.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
  const sources = (refs.length ? refs : ["graph.json"]).map((ref, index) => ({
    id: `source.migrated_${index + 1}`,
    ref,
    authority: ref === "graph.json" ? "legacy_facade" : "owner_source",
    scope: "project",
    freshness: "task_boundary",
    confidentiality: "project_internal"
  }));
  return { contract_version: "1.0.0", sources };
}

function migrationBody(root: string): Omit<ProjectMigrationResult, "digest"> {
  const detection = detectProjectCapsule(root);
  if (detection.status === "current") return { contract_version: "1.0.0", project_root: root, mode: "dry_run", status: "already_current", source_layout: "graph_v2", target_layout: "mirai_project_capsule", inventory: [], path_map: [], conflicts: [], rollback_plan: [], approval_ref: null, canonical_write_allowed: false };
  const legacy = readLegacyManifest(root);
  const inventory = [{ path: "graph.json", digest: sha256(fs.readFileSync(path.join(root, "graph.json"))) }, ...inventoryDirectory(root, "graph")];
  const conflicts: string[] = [];
  if (fs.existsSync(path.join(root, "mirai"))) conflicts.push("target_mirai_directory_exists");
  if (!fs.existsSync(path.join(root, "graph"))) conflicts.push("legacy_graph_directory_missing");
  if (inventory.some((item) => isNonPortableLegacyPath(item.path))) {
    conflicts.push("legacy_graph_contains_nonportable_runtime_or_generated_state");
  }
  const pathMap = inventory.map((item) => ({ from: item.path, to: item.path === "graph.json" ? "graph.json (generated compatibility facade)" : mapGraphPath(item.path) }));
  void legacy;
  return { contract_version: "1.0.0", project_root: root, mode: "dry_run", status: conflicts.length ? "blocked" : "ready", source_layout: "graph_v2", target_layout: "mirai_project_capsule", inventory, path_map: pathMap, conflicts, rollback_plan: ["verify post-migration hashes are unchanged", "move mirai/graph back to graph/", "restore original graph.json from .mirai/migration-backups", "remove generated capsule only after readback"], approval_ref: null, canonical_write_allowed: false };
}

export function planProjectMigration(projectRoot: string): ProjectMigrationResult {
  const body = migrationBody(path.resolve(projectRoot));
  return { ...body, digest: digestValue(body) };
}

function readApproval(filename: string, root: string, action: MigrationApproval["action"]): MigrationApproval {
  const approval = JSON.parse(fs.readFileSync(filename, "utf8")) as MigrationApproval;
  if (!approval || approval.action !== action || approval.approved !== true || path.resolve(approval.project_root) !== root || !approval.approval_id) throw new Error("invalid_migration_approval");
  if (!Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) <= Date.now()) throw new Error("expired_migration_approval");
  return approval;
}

export function applyProjectMigration(projectRoot: string, approvalFile: string): ProjectMigrationResult {
  const root = path.resolve(projectRoot);
  const plan = planProjectMigration(root);
  if (plan.status === "already_current") return plan;
  if (plan.status !== "ready") throw new Error(`migration_blocked:${plan.conflicts.join(",")}`);
  const approval = readApproval(path.resolve(approvalFile), root, "mirai_project_migration");
  const legacy = readLegacyManifest(root);
  const manifest = migratedManifest(root, legacy);
  const local = path.join(root, ".mirai");
  const backupRoot = path.join(local, "migration-backups", plan.digest.replace("sha256:", ""));
  const stagingRoot = path.join(local, `migration-staging-${process.pid}`);
  fs.mkdirSync(path.join(stagingRoot, "mirai"), { recursive: true });
  for (const dir of ["programs", "components", "policies", "interfaces", "context", "migrations", "proposals"]) fs.mkdirSync(path.join(stagingRoot, "mirai", dir), { recursive: true });
  fs.cpSync(path.join(root, "graph"), path.join(stagingRoot, "mirai", "graph"), { recursive: true, errorOnExist: true });
  fs.writeFileSync(path.join(stagingRoot, "mirai", "manifest.yaml"), stringify(manifest, { sortMapEntries: true }), "utf8");
  fs.writeFileSync(path.join(stagingRoot, "mirai", "owner-notes.md"), "# Owner Notes\n\nMigrated from the Mirai Graph v2 layout.\n", "utf8");
  fs.writeFileSync(path.join(stagingRoot, "mirai", "sources.yaml"), stringify(migratedSourceCatalog(legacy), { sortMapEntries: true }), "utf8");
  compileProjectCapsule(stagingRoot);
  const stagedValidation = validateProjectCapsule(stagingRoot);
  if (!stagedValidation.valid) throw new Error(`staged_capsule_invalid:${stagedValidation.errors.join(",")}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.copyFileSync(path.join(root, "graph.json"), path.join(backupRoot, "graph.json"));
  fs.renameSync(path.join(root, "graph"), path.join(backupRoot, "graph"));
  fs.renameSync(path.join(stagingRoot, "mirai"), path.join(root, "mirai"));
  const facadeTemp = path.join(root, ".graph.json.mirai-migration.tmp");
  fs.writeFileSync(facadeTemp, `${JSON.stringify(createLegacyFacade(readProjectManifest(root), legacy), null, 2)}\n`, "utf8");
  fs.renameSync(facadeTemp, path.join(root, "graph.json"));
  const validation = validateProjectCapsule(root);
  if (!validation.valid) throw new Error(`post_migration_validation_failed:${validation.errors.join(",")}`);
  const body: Omit<ProjectMigrationResult, "digest"> = { ...plan, mode: "apply", status: "applied", approval_ref: approval.approval_id, canonical_write_allowed: true };
  const result = { ...body, digest: digestValue(body) };
  fs.writeFileSync(path.join(backupRoot, "migration-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function latestMigrationBackup(root: string): string | null {
  const base = path.join(root, ".mirai", "migration-backups");
  if (!fs.existsSync(base)) return null;
  const candidates = fs.readdirSync(base).sort().reverse().map((name) => path.join(base, name)).filter((dir) => fs.existsSync(path.join(dir, "migration-result.json")));
  return candidates[0] || null;
}

export function rollbackProjectMigration(projectRoot: string, approvalFile: string): ProjectMigrationResult {
  const root = path.resolve(projectRoot);
  const approval = readApproval(path.resolve(approvalFile), root, "mirai_project_migration_rollback");
  const backup = latestMigrationBackup(root);
  if (!backup) {
    if (detectProjectCapsule(root).status === "legacy_detected") {
      const body: Omit<ProjectMigrationResult, "digest"> = { contract_version: "1.0.0", project_root: root, mode: "rollback", status: "rolled_back", source_layout: "graph_v2", target_layout: "mirai_project_capsule", inventory: [], path_map: [], conflicts: [], rollback_plan: [], approval_ref: approval.approval_id, canonical_write_allowed: true };
      return { ...body, digest: digestValue(body) };
    }
    throw new Error("migration_backup_missing");
  }
  const previousRollback = path.join(backup, "rollback-result.json");
  if (detectProjectCapsule(root).status === "legacy_detected" && fs.existsSync(previousRollback)) {
    return JSON.parse(fs.readFileSync(previousRollback, "utf8")) as ProjectMigrationResult;
  }
  const original = JSON.parse(fs.readFileSync(path.join(backup, "migration-result.json"), "utf8")) as ProjectMigrationResult;
  const mismatches: string[] = [];
  for (const item of original.inventory.filter((entry) => entry.path.startsWith("graph/"))) {
    const current = path.join(root, mapGraphPath(item.path));
    if (!fs.existsSync(current) || sha256(fs.readFileSync(current)) !== item.digest) mismatches.push(item.path);
  }
  if (mismatches.length) throw new Error(`rollback_hash_mismatch:${mismatches.join(",")}`);
  const capsule = path.join(root, "mirai");
  if (!fs.existsSync(capsule)) throw new Error("current_capsule_missing");
  const preservedCapsule = path.join(backup, "capsule-after-rollback");
  if (fs.existsSync(preservedCapsule)) throw new Error("rollback_already_recorded");
  fs.renameSync(path.join(capsule, "graph"), path.join(root, "graph"));
  fs.renameSync(capsule, preservedCapsule);
  fs.copyFileSync(path.join(backup, "graph.json"), path.join(root, "graph.json"));
  const body: Omit<ProjectMigrationResult, "digest"> = { ...original, mode: "rollback", status: "rolled_back", conflicts: [], approval_ref: approval.approval_id, canonical_write_allowed: true };
  const result = { ...body, digest: digestValue(body) };
  fs.writeFileSync(path.join(backup, "rollback-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
