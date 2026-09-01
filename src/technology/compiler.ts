import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { compileProgramSource } from "../program/compiler.js";
import type { MiraiProgram, ProgramNode } from "../program/types.js";
import { TECHNOLOGY_DRAFT_CONTRACT_VERSION, type TechnologyDraft, type TechnologyStep } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sourceLine(source: string, id: string): number | undefined {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(id));
  return index >= 0 ? index + 1 : undefined;
}

function parseStructured(source: string, filename: string): Record<string, unknown> | undefined {
  try {
    const value = filename.endsWith(".json") ? JSON.parse(source) : YAML.parse(source);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function extractTechnologySource(source: string, filename = "technology.md"): TechnologyDraft {
  const parsed = parseStructured(source, filename);
  if (parsed && Array.isArray(parsed.steps)) {
    const draft = {
      contract_version: TECHNOLOGY_DRAFT_CONTRACT_VERSION,
      id: typeof parsed.id === "string" ? parsed.id : "technology.extracted",
      version: typeof parsed.version === "string" ? parsed.version : "0.1.0",
      goal: typeof parsed.goal === "string" ? parsed.goal : "",
      roles: Array.isArray(parsed.roles) ? parsed.roles.filter((item): item is string => typeof item === "string") : [],
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
      state: Array.isArray(parsed.state) ? parsed.state : [],
      imports: Array.isArray(parsed.imports) ? parsed.imports : [],
      steps: parsed.steps.map((item) => isRecord(item) && typeof item.id === "string" ? { ...item, source_line: sourceLine(source, item.id) } : item),
      entry: typeof parsed.entry === "string" ? parsed.entry : "",
      gates: Array.isArray(parsed.gates) ? parsed.gates.filter((item): item is string => typeof item === "string") : [],
      policies: isRecord(parsed.policies) ? parsed.policies : {},
      terminal_conditions: Array.isArray(parsed.terminal_conditions) ? parsed.terminal_conditions.filter((item): item is string => typeof item === "string") : [],
      diagnostics: [],
      source_ref: filename,
      confidence: 1,
      canonical_write_allowed: false
    } as unknown as TechnologyDraft;
    draft.diagnostics = diagnoseTechnologyDraft(draft);
    draft.confidence = draft.diagnostics.some((item) => item.severity === "blocking") ? 0.5 : 1;
    return draft;
  }

  const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Extracted technology";
  const steps = [...source.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm)].map((match, index) => ({
    id: `step.${index + 1}`,
    kind: "action" as const,
    operation: match[2]?.trim() || `step_${index + 1}`,
    effects: [],
    next: index + 1 < [...source.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm)].length ? `step.${index + 2}` : "",
    on_error: "",
    source_line: source.slice(0, match.index).split(/\r?\n/).length
  }));
  return {
    contract_version: TECHNOLOGY_DRAFT_CONTRACT_VERSION,
    id: `technology.${path.basename(filename).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "_")}`,
    version: "0.1.0",
    goal: heading,
    roles: [], inputs: [], outputs: [], state: [], imports: [], steps,
    entry: steps[0]?.id || "",
    gates: [],
    policies: { budgets: { max_steps: 100, max_depth: 10, max_iterations: 10, max_parallel: 4, max_duration_ms: 60000 }, allowed_effects: ["pure"], canonical_write_allowed: false },
    terminal_conditions: [],
    diagnostics: [
      { code: "unstructured_text_requires_review", severity: "blocking", message: "Free text was extracted as a proposal, but operation bindings, error routes, gates and completion evidence require owner review." }
    ],
    source_ref: filename,
    confidence: steps.length ? 0.4 : 0,
    canonical_write_allowed: false
  };
}

export function extractTechnologyFile(filename: string): TechnologyDraft {
  const absolute = path.resolve(filename);
  return extractTechnologySource(fs.readFileSync(absolute, "utf8"), path.basename(absolute));
}

export function diagnoseTechnologyDraft(draft: TechnologyDraft): TechnologyDraft["diagnostics"] {
  const diagnostics: TechnologyDraft["diagnostics"] = [];
  if (draft.contract_version !== TECHNOLOGY_DRAFT_CONTRACT_VERSION) diagnostics.push({ code: "unsupported_contract", severity: "blocking", message: "Unsupported technology draft contract." });
  if (!draft.goal) diagnostics.push({ code: "goal_required", severity: "blocking", message: "Technology goal is required." });
  if (!draft.entry) diagnostics.push({ code: "entry_required", severity: "blocking", message: "Entry step is required." });
  if (!draft.steps.length) diagnostics.push({ code: "steps_required", severity: "blocking", message: "At least one step is required." });
  if (!draft.terminal_conditions.length) diagnostics.push({ code: "terminal_evidence_required", severity: "blocking", message: "Explicit terminal conditions or completion evidence are required." });
  if (draft.canonical_write_allowed !== false || draft.policies?.canonical_write_allowed !== false) diagnostics.push({ code: "canonical_write_forbidden", severity: "blocking", message: "Technology extraction cannot authorize canonical writes." });
  const ids = new Set(draft.steps.map((item) => item.id));
  if (draft.entry && !ids.has(draft.entry)) diagnostics.push({ code: "unknown_entry", severity: "blocking", message: `Unknown entry step ${draft.entry}.` });
  const requireRef = (ref: string | undefined, label: string) => { if (!ref || !ids.has(ref)) diagnostics.push({ code: "unknown_step_ref", severity: "blocking", message: `${label} references unknown step ${ref || "<missing>"}.` }); };
  for (const step of draft.steps) {
    if (step.kind === "action") {
      if (!step.operation) diagnostics.push({ code: "operation_required", severity: "blocking", message: `Action ${step.id} requires an operation.` });
      requireRef(step.next, `${step.id}.next`); requireRef(step.on_error, `${step.id}.on_error`);
      if (step.effects.some((effect) => effect !== "pure") && !step.capability) diagnostics.push({ code: "capability_required", severity: "blocking", message: `Action ${step.id} requires an explicit capability.` });
    } else if (step.kind === "branch") {
      requireRef(step.then, `${step.id}.then`); requireRef(step.else, `${step.id}.else`);
    } else if (step.kind === "foreach") {
      if (!Number.isInteger(step.max_iterations) || step.max_iterations < 1) diagnostics.push({ code: "bounded_loop_required", severity: "blocking", message: `Loop ${step.id} requires max_iterations.` });
      requireRef(step.next, `${step.id}.next`);
    } else if (step.kind === "parallel") {
      if (!step.branches.length || !Number.isInteger(step.max_parallel) || step.max_parallel < 1) diagnostics.push({ code: "parallel_budget_required", severity: "blocking", message: `Parallel step ${step.id} requires branches and max_parallel.` });
      if (step.join === "quorum" && (!step.quorum || step.quorum < 1 || step.quorum > step.branches.length)) diagnostics.push({ code: "invalid_quorum", severity: "blocking", message: `Parallel step ${step.id} has invalid quorum.` });
      if (["any_success_ordered", "quorum"].includes(step.join)) diagnostics.push({ code: "unsupported_program_join", severity: "blocking", message: `Parallel step ${step.id} uses an activation join that Mirai Program 1.0 cannot preserve.` });
      requireRef(step.next, `${step.id}.next`);
    } else if (step.kind === "await") {
      if (!step.deadline_ms) diagnostics.push({ code: "await_deadline_required", severity: "blocking", message: `Await ${step.id} requires a deadline.` });
      requireRef(step.next, `${step.id}.next`); requireRef(step.on_timeout, `${step.id}.on_timeout`);
    }
  }
  return diagnostics;
}

function stepToNode(step: TechnologyStep): ProgramNode {
  if (step.kind === "action") return {
    id: step.id, kind: "call",
    target: step.program_ref ? { kind: "program", program: step.program_ref } : { kind: "adapter", adapter: step.adapter || "pure", operation: step.operation },
    args: {}, effects: step.effects as never[], ...(step.capability ? { capability: step.capability } : {}),
    next: step.next, on_error: step.on_error
  } as ProgramNode;
  if (step.kind === "branch") return { id: step.id, kind: "branch", condition: step.condition, then: step.then, else: step.else } as ProgramNode;
  if (step.kind === "foreach") return { id: step.id, kind: "foreach", items: step.items, item: step.item, program: step.program_ref, max_iterations: step.max_iterations, next: step.next } as ProgramNode;
  if (step.kind === "parallel") return { id: step.id, kind: "parallel", branches: step.branches.map((item) => ({ id: item.id, program: item.program_ref, args: {} })), merge: step.join === "collect" ? "array" : "all_success", max_parallel: step.max_parallel, next: step.next } as ProgramNode;
  if (step.kind === "await") return { id: step.id, kind: "await", event: step.event, deadline_ms: step.deadline_ms, on_timeout: step.on_timeout, next: step.next } as ProgramNode;
  return { id: step.id, kind: "return", values: step.values } as ProgramNode;
}

export function compileTechnologyDraft(draft: TechnologyDraft): MiraiProgram {
  const diagnostics = diagnoseTechnologyDraft(draft);
  if (draft.diagnostics.some((item) => item.severity === "blocking" && item.code === "unstructured_text_requires_review")) diagnostics.push(...draft.diagnostics);
  const blockers = [...new Map(diagnostics.filter((item) => item.severity === "blocking").map((item) => [item.code + item.message, item])).values()];
  if (blockers.length) throw new Error(`technology_draft_blocked:${blockers.map((item) => item.code).join(",")}`);
  const sourceMap = Object.fromEntries(draft.steps.map((step) => [step.id, { file: draft.source_ref, ...(step.source_line ? { line: step.source_line } : {}) }]));
  const program = {
    contract_version: "1.0.0", id: draft.id, version: draft.version,
    imports: draft.imports, inputs: draft.inputs, outputs: draft.outputs, state: draft.state,
    nodes: draft.steps.map(stepToNode), entry: draft.entry, error_routes: [], policies: draft.policies,
    source_map: sourceMap
  };
  return compileProgramSource(JSON.stringify(program), `${draft.id}.mirai.json`).program;
}
