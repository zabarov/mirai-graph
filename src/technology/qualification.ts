import { digestValue, withoutDigest } from "../core/canonical.js";
import { compileTechnologyDraft, diagnoseTechnologyDraft } from "./compiler.js";
import {
  HYBRID_TECHNOLOGY_PLAN_CONTRACT_VERSION,
  TECHNOLOGY_QUALIFICATION_CONTRACT_VERSION,
  type HybridOperationMode,
  type HybridTechnologyOperation,
  type HybridTechnologyPlan,
  type OperationQualificationBinding,
  type QualifiedTechnologyOperation,
  type TechnologyDiagnostic,
  type TechnologyDraft,
  type TechnologyQualificationResult,
  type TechnologyQualificationStatus
} from "./types.js";

function blocking(code: string, message: string): TechnologyDiagnostic {
  return { code, severity: "blocking", message };
}

function uniqueBindings(bindings: OperationQualificationBinding[]): { byStep: Map<string, OperationQualificationBinding>; diagnostics: TechnologyDiagnostic[] } {
  const byStep = new Map<string, OperationQualificationBinding>();
  const diagnostics: TechnologyDiagnostic[] = [];
  for (const binding of bindings) {
    if (byStep.has(binding.step_id)) diagnostics.push(blocking("duplicate_operation_binding", `Operation ${binding.step_id} has more than one qualification binding.`));
    else byStep.set(binding.step_id, binding);
  }
  return { byStep, diagnostics };
}

function qualifyOperation(step: Extract<TechnologyDraft["steps"][number], { kind: "action" }>, binding: OperationQualificationBinding | undefined): QualifiedTechnologyOperation {
  if (!binding) return {
    step_id: step.id,
    operation: step.operation,
    classification: "unsupported",
    acceptance: "unreviewed",
    reason: "No explicit qualification binding was supplied.",
    blockers: ["operation_classification_required"]
  };

  const programRef = binding.program_ref || step.program_ref;
  const adapter = binding.adapter || step.adapter;
  const effects = binding.effects || step.effects;
  const capability = binding.capability || step.capability;
  const blockers: string[] = [];
  if (!binding.reason.trim()) blockers.push("qualification_reason_required");
  if (binding.classification === "unsupported") blockers.push("unsupported_operation");
  if (binding.acceptance === "unreviewed") blockers.push("qualification_acceptance_required");
  if (binding.acceptance !== "unreviewed" && !binding.acceptance_ref) blockers.push("acceptance_ref_required");

  if (binding.classification === "executable") {
    if (!programRef && !adapter) blockers.push("execution_binding_required");
    if (adapter && !effects.length) blockers.push("effect_declaration_required");
    if (effects.some((effect) => effect !== "pure") && !capability) blockers.push("capability_required");
  }
  if (binding.classification === "verifiable") {
    if (!binding.verification_ref) blockers.push("verification_ref_required");
    if (binding.acceptance !== "tester_accepted") blockers.push("tester_acceptance_required");
  }
  if (binding.classification === "advisory" || binding.classification === "decision") {
    if (!binding.owner_ref) blockers.push("owner_ref_required");
    if (binding.acceptance !== "owner_accepted") blockers.push("owner_acceptance_required");
    if (programRef || adapter || effects.length) blockers.push("human_operation_cannot_bind_effect");
  }

  return {
    ...binding,
    operation: step.operation,
    ...(programRef ? { program_ref: programRef } : {}),
    ...(adapter ? { adapter } : {}),
    effects,
    ...(capability ? { capability } : {}),
    blockers: [...new Set(blockers)]
  };
}

function qualificationStatus(operations: QualifiedTechnologyOperation[], diagnostics: TechnologyDiagnostic[]): TechnologyQualificationStatus {
  if (diagnostics.length || operations.some((item) => item.blockers.some((blocker) => blocker !== "qualification_acceptance_required"))) return "blocked";
  if (operations.some((item) => item.acceptance === "unreviewed")) return "program_candidate";
  const hasExecutable = operations.some((item) => item.classification === "executable");
  const hasHuman = operations.some((item) => item.classification === "advisory" || item.classification === "decision");
  if (!hasExecutable) return "instruction_only";
  if (hasHuman) return "hybrid_ready";
  return "executable_ready";
}

export function qualifyTechnologyDraft(draft: TechnologyDraft, bindings: OperationQualificationBinding[]): TechnologyQualificationResult {
  const actions = draft.steps.filter((step): step is Extract<TechnologyDraft["steps"][number], { kind: "action" }> => step.kind === "action");
  const { byStep, diagnostics } = uniqueBindings(bindings);
  const actionIds = new Set(actions.map((step) => step.id));
  for (const binding of bindings) if (!actionIds.has(binding.step_id)) diagnostics.push(blocking("unknown_operation_binding", `Qualification binding references unknown action ${binding.step_id}.`));

  const draftDiagnostics = diagnoseTechnologyDraft(draft).filter((item) => item.severity === "blocking");
  if (draft.diagnostics.some((item) => item.severity === "blocking")) draftDiagnostics.push(...draft.diagnostics.filter((item) => item.severity === "blocking"));
  const operations = actions.map((step) => qualifyOperation(step, byStep.get(step.id)));
  const operationDiagnostics = operations.flatMap((operation) => operation.blockers.map((code) => blocking(code, `Operation ${operation.step_id}: ${code}.`)));
  const blockingDiagnostics = [...new Map([...diagnostics, ...draftDiagnostics, ...operationDiagnostics].map((item) => [`${item.code}:${item.message}`, item])).values()];
  const status = qualificationStatus(operations, blockingDiagnostics.filter((item) => item.code !== "qualification_acceptance_required"));
  const candidate = {
    contract_version: TECHNOLOGY_QUALIFICATION_CONTRACT_VERSION,
    technology_id: draft.id,
    technology_version: draft.version,
    source_ref: draft.source_ref,
    draft_digest: digestValue(draft),
    status,
    operations,
    blocking_diagnostics: blockingDiagnostics,
    simulation_allowed: status !== "blocked",
    activation_allowed: false,
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}

function operationMode(classification: QualifiedTechnologyOperation["classification"]): HybridOperationMode {
  if (classification === "executable") return "program_operation";
  if (classification === "verifiable") return "verification_gate";
  if (classification === "advisory") return "advisory_checkpoint";
  if (classification === "decision") return "decision_checkpoint";
  return "unsupported_blocker";
}

export function compileHybridTechnologyPlan(draft: TechnologyDraft, qualification: TechnologyQualificationResult): HybridTechnologyPlan {
  const expectedDraftDigest = digestValue(draft);
  if (qualification.technology_id !== draft.id || qualification.technology_version !== draft.version || qualification.draft_digest !== expectedDraftDigest) {
    throw new Error("technology_qualification_mismatch");
  }
  if (qualification.digest !== digestValue(withoutDigest(qualification as unknown as Record<string, unknown>))) throw new Error("technology_qualification_digest_mismatch");
  const reconstructedBindings = qualification.operations.map(({ operation: _operation, blockers: _blockers, ...binding }) => binding);
  if (qualifyTechnologyDraft(draft, reconstructedBindings).digest !== qualification.digest) throw new Error("technology_qualification_semantic_mismatch");
  if (qualification.status === "blocked" || qualification.status === "program_candidate") throw new Error(`technology_qualification_not_ready:${qualification.status}`);

  const byStep = new Map(qualification.operations.map((operation) => [operation.step_id, operation]));
  const operations: HybridTechnologyOperation[] = draft.steps
    .filter((step): step is Extract<TechnologyDraft["steps"][number], { kind: "action" }> => step.kind === "action")
    .map((step) => {
      const binding = byStep.get(step.id);
      if (!binding) throw new Error(`technology_qualification_missing_operation:${step.id}`);
      return {
        step_id: step.id,
        operation: step.operation,
        classification: binding.classification,
        acceptance: binding.acceptance,
        ...(binding.acceptance_ref ? { acceptance_ref: binding.acceptance_ref } : {}),
        reason: binding.reason,
        mode: operationMode(binding.classification),
        next: step.next,
        on_error: step.on_error,
        ...(binding.program_ref ? { program_ref: binding.program_ref } : {}),
        ...(binding.adapter ? { adapter: binding.adapter } : {}),
        effects: binding.effects || [],
        ...(binding.capability ? { capability: binding.capability } : {}),
        ...(binding.verification_ref ? { verification_ref: binding.verification_ref } : {}),
        ...(binding.owner_ref ? { owner_ref: binding.owner_ref } : {})
      };
    });

  let runtimeProgramDigest: string | undefined;
  if (qualification.status === "executable_ready") {
    const qualifiedDraft: TechnologyDraft = {
      ...draft,
      steps: draft.steps.map((step) => {
        if (step.kind !== "action") return step;
        const binding = byStep.get(step.id);
        if (!binding) return step;
        return {
          ...step,
          ...(binding.program_ref ? { program_ref: binding.program_ref } : {}),
          ...(binding.adapter ? { adapter: binding.adapter } : {}),
          effects: binding.effects || step.effects,
          ...(binding.capability ? { capability: binding.capability } : {})
        };
      })
    };
    runtimeProgramDigest = compileTechnologyDraft(qualifiedDraft).digest;
  }

  const candidate = {
    contract_version: HYBRID_TECHNOLOGY_PLAN_CONTRACT_VERSION,
    id: draft.id,
    version: draft.version,
    goal: draft.goal,
    source_ref: draft.source_ref,
    draft_digest: expectedDraftDigest,
    qualification_digest: qualification.digest,
    qualification_status: qualification.status,
    entry: draft.entry,
    operations,
    control_steps: draft.steps.filter((step): step is Exclude<TechnologyDraft["steps"][number], { kind: "action" }> => step.kind !== "action"),
    gates: draft.gates,
    terminal_conditions: draft.terminal_conditions,
    ...(runtimeProgramDigest ? { runtime_program_digest: runtimeProgramDigest } : {}),
    requires_human_coordination: qualification.status === "hybrid_ready" || qualification.status === "instruction_only",
    activation_allowed: false,
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
