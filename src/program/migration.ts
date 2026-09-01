import fs from "node:fs";
import path from "node:path";
import { canonicalize } from "../core/canonical.js";
import { programDigest } from "./digest.js";
import type { CallNode, Expression, MiraiProgram, ProgramNode, SlotDefinition } from "./types.js";
import { validateProgram } from "./validator.js";

interface LegacyOperation {
  id: string;
  capability_ref?: string;
  prerequisites?: string[];
}

interface LegacyTechnology {
  id: string;
  version: string;
  operations: LegacyOperation[];
  scenarios: Array<{ id: string; operation_ids: string[] }>;
}

interface OperationBinding {
  adapter: string;
  operation: string;
  effects: string[];
  capability?: string;
  args?: Record<string, Expression>;
  result?: string;
}

interface MigrationBindings {
  technology_id: string;
  inputs?: SlotDefinition[];
  outputs?: SlotDefinition[];
  operations: Record<string, OperationBinding>;
}

export interface MigrationResult {
  contract_version: "1.0.0";
  operation: "mirai.migrate.1_4_to_2_0";
  status: "ready" | "blocked";
  source_technology_id: string;
  source_version: string;
  blockers: string[];
  warnings: string[];
  candidate_program: MiraiProgram | null;
  canonical_write_allowed: false;
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function locateTechnology(target: string): string {
  const absolute = path.resolve(target);
  if (fs.statSync(absolute).isFile()) return absolute;
  const candidates = [
    path.join(absolute, "technology.json"),
    path.join(absolute, "graph", "specs", "technology.json"),
    path.join(absolute, "examples", "executable-technology-course", "technology.json")
  ].filter((item) => fs.existsSync(item));
  if (candidates.length !== 1) throw new Error(candidates.length ? "Multiple executable technologies found; pass an exact file" : "Executable technology not found");
  return candidates[0] as string;
}

function orderedOperations(technology: LegacyTechnology, operationIds: string[], blockers: string[]): LegacyOperation[] {
  const byId = new Map(technology.operations.map((item) => [item.id, item]));
  const needed = new Set<string>();
  function add(id: string): void {
    if (needed.has(id)) return;
    const operation = byId.get(id);
    if (!operation) { blockers.push(`unknown_operation:${id}`); return; }
    needed.add(id);
    for (const dependency of operation.prerequisites || []) add(dependency);
  }
  operationIds.forEach(add);
  const result: LegacyOperation[] = [];
  const pending = new Set(needed);
  while (pending.size) {
    const ready = [...pending].filter((id) => (byId.get(id)?.prerequisites || []).every((dep) => !pending.has(dep))).sort();
    if (!ready.length) { blockers.push("dependency_cycle"); break; }
    for (const id of ready) { result.push(byId.get(id) as LegacyOperation); pending.delete(id); }
  }
  return result;
}

export function migrateTechnology(technology: LegacyTechnology, bindings?: MigrationBindings): MigrationResult {
  const blockers: string[] = [];
  const warnings = ["Migration preserves declared order and dependencies but does not infer runtime bindings."];
  if (!technology?.id || !technology.version || !Array.isArray(technology.operations) || !Array.isArray(technology.scenarios)) blockers.push("invalid_executable_technology");
  if (!bindings) blockers.push("bindings_required");
  else if (bindings.technology_id !== technology.id) blockers.push("bindings_technology_mismatch");
  for (const operation of technology.operations || []) if (!bindings?.operations?.[operation.id]) blockers.push(`binding_required:${operation.id}:${operation.capability_ref || "unknown"}`);
  const scenario = technology.scenarios?.[0];
  if (!scenario) blockers.push("scenario_required");
  if (technology.scenarios?.length > 1) warnings.push("Only the first scenario becomes one candidate program; other scenarios require separate programs.");
  const ordered = scenario ? orderedOperations(technology, scenario.operation_ids, blockers) : [];
  if (blockers.length) return {
    contract_version: "1.0.0", operation: "mirai.migrate.1_4_to_2_0", status: "blocked",
    source_technology_id: technology.id || "unknown", source_version: technology.version || "unknown",
    blockers: [...new Set(blockers)].sort(), warnings, candidate_program: null, canonical_write_allowed: false
  };
  const nodes: ProgramNode[] = ordered.map((operation, index) => {
    const binding = bindings?.operations[operation.id] as OperationBinding;
    const result: CallNode = {
      id: operation.id, kind: "call",
      target: { kind: "adapter", adapter: binding.adapter, operation: binding.operation },
      args: binding.args || {}, effects: binding.effects, next: ordered[index + 1]?.id || "migration.return"
    };
    if (binding.result) result.result = binding.result;
    if (binding.capability) result.capability = binding.capability;
    return result;
  });
  nodes.push({ id: "migration.return", kind: "return", values: Object.fromEntries((bindings?.outputs || []).map((slot) => [slot.id, { op: "ref", path: `state.${slot.id}` }])) });
  const sourceMap = Object.fromEntries(nodes.map((node) => [node.id, { file: "migration:executable-technology" }]));
  const candidate = canonicalize({
    contract_version: "1.0.0", id: `${technology.id}.${scenario?.id || "default"}`, version: technology.version,
    imports: [], inputs: bindings?.inputs || [], outputs: bindings?.outputs || [], state: bindings?.outputs || [],
    nodes, entry: ordered[0]?.id || "migration.return", error_routes: [],
    policies: {
      budgets: { max_steps: Math.max(nodes.length * 4, 16), max_depth: 16, max_iterations: 100, max_parallel: 4, max_duration_ms: 300000 },
      allowed_effects: [...new Set(Object.values(bindings?.operations || {}).flatMap((item) => item.effects))].sort(),
      canonical_write_allowed: false
    }, source_map: sourceMap
  }) as Omit<MiraiProgram, "digest">;
  const program = { ...candidate, digest: programDigest(candidate) } as MiraiProgram;
  const validation = validateProgram(program);
  if (!validation.valid) blockers.push(...validation.errors.map((item) => `candidate:${item}`));
  return {
    contract_version: "1.0.0", operation: "mirai.migrate.1_4_to_2_0", status: blockers.length ? "blocked" : "ready",
    source_technology_id: technology.id, source_version: technology.version,
    blockers: [...new Set(blockers)].sort(), warnings, candidate_program: blockers.length ? null : program,
    canonical_write_allowed: false
  };
}

export function migrateTechnologyTarget(target: string, bindingFile?: string): MigrationResult {
  const technology = readJson(locateTechnology(target)) as LegacyTechnology;
  const bindings = bindingFile ? readJson(path.resolve(bindingFile)) as MigrationBindings : undefined;
  return migrateTechnology(technology, bindings);
}
