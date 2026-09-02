import { digestValue } from "../core/canonical.js";
import type { NormalizedUnit } from "../sources/types.js";
import {
  PROCESS_CANDIDATE_CONTRACT_VERSION,
  PROCESS_OBSERVATION_CONTRACT_VERSION,
  TECHNOLOGY_DRAFT_CONTRACT_VERSION,
  type ProcessCandidate,
  type ProcessEvidenceMode,
  type ProcessObservation,
  type TechnologyDraft,
  type TechnologyStep
} from "./types.js";

function operationName(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 96) || "unknown_operation";
}

export function observationsFromUnits(units: NormalizedUnit[], options: { mode: ProcessEvidenceMode; process_hint?: string }): ProcessObservation[] {
  return units.map((unit) => {
    const text = typeof unit.content === "string" ? unit.content : JSON.stringify(unit.content);
    const lines = text.split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    const candidates = lines.filter((line) => /^(?:\d+[.)]|[-*]|step\b|шаг\b|затем\b|после\b|если\b)/i.test(line));
    const sequence = (candidates.length ? candidates : lines.slice(0, 1)).map((line, index) => ({
      id: `step.${index + 1}`,
      operation: operationName(line.replace(/^(?:\d+[.)]|[-*])\s*/, "")),
      ...( /^(?:если|if)\b/i.test(line) ? { condition: line } : {}),
      effects: [] as string[],
      outcome: "unknown" as const
    }));
    return {
      contract_version: PROCESS_OBSERVATION_CONTRACT_VERSION,
      id: `observation.${digestValue({ source: unit.source_ref, mode: options.mode, sequence }).slice(7, 23)}`,
      source_ref: unit.source_ref,
      source_digest: unit.content_digest,
      mode: options.mode,
      process_hint: options.process_hint || operationName(unit.source_ref),
      sequence,
      confidence: candidates.length ? 0.75 : 0.25,
      authority: unit.authority,
      canonical_write_allowed: false as const
    };
  });
}

export function discoverProcessCandidates(observations: ProcessObservation[], budgets: { max_observations?: number; max_steps?: number } = {}): ProcessCandidate[] {
  const maxObservations = budgets.max_observations ?? 10_000;
  const maxSteps = budgets.max_steps ?? 1_000;
  if (observations.length > maxObservations) throw new Error("process_observation_budget_exceeded");
  const groups = new Map<string, ProcessObservation[]>();
  for (const observation of observations) {
    if (observation.contract_version !== PROCESS_OBSERVATION_CONTRACT_VERSION || observation.canonical_write_allowed !== false) throw new Error("process_observation_contract_invalid");
    const key = `${observation.mode}:${operationName(observation.process_hint)}`;
    groups.set(key, [...(groups.get(key) || []), observation]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
    const [mode, ...hintParts] = key.split(":");
    const hint = hintParts.join(":");
    const maxLength = Math.max(0, ...items.map((item) => item.sequence.length));
    if (maxLength > maxSteps) throw new Error("process_step_budget_exceeded");
    const controlFlow: ProcessCandidate["control_flow"] = [];
    for (let ordinal = 0; ordinal < maxLength; ordinal += 1) {
      const steps = items.map((item) => item.sequence[ordinal]).filter((item): item is NonNullable<typeof item> => Boolean(item));
      const counts = new Map<string, number>();
      steps.forEach((step) => counts.set(step.operation, (counts.get(step.operation) || 0) + 1));
      const operation = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "unknown_operation";
      controlFlow.push({
        ordinal: ordinal + 1,
        operation,
        ...(ordinal + 1 < maxLength ? { next: ordinal + 2 } : {}),
        conditions: [...new Set(steps.map((step) => step.condition).filter((value): value is string => Boolean(value)))].sort(),
        observed_outcomes: [...new Set(steps.map((step) => step.outcome || "unknown"))].sort(),
        effects: [...new Set(steps.flatMap((step) => step.effects))].sort()
      });
    }
    const normative = mode === "intended" && items.some((item) => item.authority === "owner_asserted" || item.authority === "canonical_external");
    const diagnostics: ProcessCandidate["diagnostics"] = [];
    if (mode === "observed") diagnostics.push({ code: "observed_practice_not_normative", severity: "blocking", message: "Observed repetition cannot become intended technology without an owner decision." });
    if (!normative && mode === "intended") diagnostics.push({ code: "normative_authority_missing", severity: "blocking", message: "Intended technology requires owner-asserted or canonical external authority." });
    if (!controlFlow.length) diagnostics.push({ code: "process_steps_missing", severity: "blocking", message: "No bounded process steps were discovered." });
    const candidate = {
      contract_version: PROCESS_CANDIDATE_CONTRACT_VERSION,
      id: `process_candidate.${digestValue({ mode, hint, refs: items.map((item) => item.id).sort() }).slice(7, 23)}`,
      process_hint: hint,
      mode: mode as ProcessEvidenceMode,
      observation_refs: items.map((item) => item.id).sort(),
      support_count: items.length,
      control_flow: controlFlow,
      confidence: items.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, items.length),
      normative_authority_present: normative,
      technology_draft_allowed: diagnostics.length === 0,
      diagnostics,
      canonical_write_allowed: false as const
    };
    return { ...candidate, digest: digestValue(candidate) };
  });
}

export function processCandidateToTechnologyDraft(candidate: ProcessCandidate): TechnologyDraft {
  if (!candidate.technology_draft_allowed || candidate.mode !== "intended") throw new Error("process_candidate_not_qualified_for_draft");
  const steps: TechnologyStep[] = candidate.control_flow.map((step, index) => ({
    id: `step.${step.ordinal}`,
    kind: "action" as const,
    operation: step.operation,
    effects: step.effects,
    next: index + 1 < candidate.control_flow.length ? `step.${step.ordinal + 1}` : "return.complete",
    on_error: "return.failed"
  }));
  steps.push({ id: "return.complete", kind: "return", values: { status: { op: "literal", value: "completed" } } });
  steps.push({ id: "return.failed", kind: "return", values: { status: { op: "literal", value: "failed" } } });
  return {
    contract_version: TECHNOLOGY_DRAFT_CONTRACT_VERSION,
    id: `technology.${candidate.process_hint}`,
    version: "0.1.0-proposal",
    goal: `Execute reviewed process ${candidate.process_hint}`,
    roles: [], inputs: [], outputs: [{ id: "status", type: "string", required: true }], state: [], imports: [],
    steps,
    entry: steps[0]?.id || "return.failed",
    gates: ["owner_review_before_program_promotion"],
    policies: { budgets: { max_steps: Math.max(16, steps.length * 4), max_depth: 16, max_iterations: 1, max_parallel: 1, max_duration_ms: 60_000 }, allowed_effects: [], canonical_write_allowed: false },
    terminal_conditions: ["status is completed or failed"],
    diagnostics: [{ code: "operation_bindings_require_qualification", severity: "blocking", message: "Discovered operations require explicit qualification before compilation." }],
    source_ref: candidate.id,
    confidence: candidate.confidence,
    canonical_write_allowed: false
  };
}
