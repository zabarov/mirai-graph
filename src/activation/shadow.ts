import path from "node:path";
import { digestValue, withoutDigest } from "../core/canonical.js";
import { resolveConfinedPath } from "../core/path-boundary.js";
import { compileProgramFile } from "../program/compiler.js";
import type { CallNode, MiraiProgram } from "../program/types.js";
import { validateActivationPlan } from "./resolver.js";
import { simulateActivationPlan } from "./simulator.js";
import type { ActivationPlan } from "./types.js";

export const SHADOW_DIFFERENTIAL_CONTRACT_VERSION = "1.0.0" as const;

export interface ShadowMandatoryStep {
  id: string;
  operation: string;
  component_instance?: string;
  required_effects: string[];
  rollback_required: boolean;
}

export interface ShadowAcceptedBaseline {
  contract_version: typeof SHADOW_DIFFERENTIAL_CONTRACT_VERSION;
  id: string;
  version: string;
  source_ref: string;
  acceptance: {
    status: "owner_accepted" | "tester_accepted";
    evidence_ref: string;
  };
  mandatory_steps: ShadowMandatoryStep[];
  allowed_scope: {
    component_instances: string[];
    operations: string[];
    capabilities: string[];
    effects: string[];
  };
  rollback_coverage: Array<{ step_id: string; strategy_ref: string }>;
  canonical_write_allowed: false;
  digest: string;
}

export interface ShadowDifferentialResult {
  contract_version: typeof SHADOW_DIFFERENTIAL_CONTRACT_VERSION;
  id: string;
  baseline_digest: string;
  plan_digest: string;
  simulation_trace_digest: string;
  zero_write_proven: true;
  mandatory_closure: {
    required_step_ids: string[];
    matched_step_ids: string[];
    missing_step_ids: string[];
  };
  scope_delta: {
    unexpected_component_instances: string[];
    unexpected_operations: string[];
    unexpected_capabilities: string[];
  };
  effect_analysis: {
    declared_effects: string[];
    unknown_effects: string[];
    program_digests: string[];
  };
  rollback_coverage: {
    required_step_ids: string[];
    covered_step_ids: string[];
    missing_step_ids: string[];
  };
  verdict: "passed" | "blocked";
  blockers: string[];
  activation_allowed: false;
  canonical_write_allowed: false;
  digest: string;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function validateBaseline(baseline: ShadowAcceptedBaseline): string[] {
  const errors: string[] = [];
  if (baseline.contract_version !== SHADOW_DIFFERENTIAL_CONTRACT_VERSION) errors.push("unsupported_shadow_baseline_contract");
  if (baseline.canonical_write_allowed !== false) errors.push("shadow_baseline_canonical_write_must_be_false");
  if (!baseline.acceptance.evidence_ref) errors.push("shadow_baseline_acceptance_evidence_required");
  if (!baseline.mandatory_steps.length) errors.push("shadow_baseline_mandatory_steps_required");
  if (new Set(baseline.mandatory_steps.map((item) => item.id)).size !== baseline.mandatory_steps.length) errors.push("shadow_baseline_duplicate_step_id");
  if (digestValue(withoutDigest(baseline as unknown as Record<string, unknown>)) !== baseline.digest) errors.push("shadow_baseline_digest_mismatch");
  return errors;
}

function loadPrograms(plan: ActivationPlan, baseDirInput: string): MiraiProgram[] {
  const baseDir = path.resolve(baseDirInput);
  return plan.activated_paths.map((activationPath) => {
    const programPath = resolveConfinedPath(baseDir, activationPath.program_ref, { label: "shadow_program_ref" });
    const program = compileProgramFile(programPath).program;
    if (program.digest !== activationPath.program_digest) throw new Error(`shadow_program_digest_mismatch:${activationPath.id}`);
    return program;
  });
}

function programEffects(program: MiraiProgram): string[] {
  const callEffects = program.nodes
    .filter((node): node is CallNode => node.kind === "call")
    .flatMap((node) => node.effects || []);
  return sortedUnique([...program.policies.allowed_effects, ...callEffects].filter((item) => item !== "pure"));
}

export function evaluateShadowDifferential(
  baseline: ShadowAcceptedBaseline,
  plan: ActivationPlan,
  options: { base_dir?: string } = {}
): ShadowDifferentialResult {
  const blockers = validateBaseline(baseline);
  const planValidation = validateActivationPlan(plan);
  blockers.push(...planValidation.errors.map((item) => `shadow_plan_invalid:${item}`));
  if (blockers.length) throw new Error([...new Set(blockers)].sort().join(","));

  const simulation = simulateActivationPlan(plan);
  const programs = loadPrograms(plan, options.base_dir || process.cwd());
  const matchedStepIds: string[] = [];
  for (const step of baseline.mandatory_steps) {
    const matchingPaths = plan.activated_paths.filter((item) =>
      item.operation === step.operation && (!step.component_instance || item.component_instance === step.component_instance)
    );
    if (matchingPaths.length) matchedStepIds.push(step.id);
  }
  const requiredStepIds = baseline.mandatory_steps.map((item) => item.id).sort();
  const missingStepIds = requiredStepIds.filter((id) => !matchedStepIds.includes(id));

  const unexpectedComponentInstances = sortedUnique(plan.activated_paths.map((item) => item.component_instance)
    .filter((item) => !baseline.allowed_scope.component_instances.includes(item)));
  const unexpectedOperations = sortedUnique(plan.activated_paths.map((item) => item.operation)
    .filter((item) => !baseline.allowed_scope.operations.includes(item)));
  const unexpectedCapabilities = sortedUnique(plan.required_capabilities
    .filter((item) => !baseline.allowed_scope.capabilities.includes(item)));
  const declaredEffects = sortedUnique(programs.flatMap(programEffects));
  const unknownEffects = declaredEffects.filter((item) => !baseline.allowed_scope.effects.includes(item));

  const rollbackRequired = baseline.mandatory_steps.filter((item) => item.rollback_required || item.required_effects.length > 0).map((item) => item.id).sort();
  const coveredSteps = sortedUnique(baseline.rollback_coverage.filter((item) => item.strategy_ref).map((item) => item.step_id))
    .filter((item) => rollbackRequired.includes(item));
  const missingRollback = rollbackRequired.filter((item) => !coveredSteps.includes(item));

  blockers.push(...missingStepIds.map((item) => `mandatory_step_missing:${item}`));
  blockers.push(...unexpectedComponentInstances.map((item) => `scope_component_unexpected:${item}`));
  blockers.push(...unexpectedOperations.map((item) => `scope_operation_unexpected:${item}`));
  blockers.push(...unexpectedCapabilities.map((item) => `scope_capability_unexpected:${item}`));
  blockers.push(...unknownEffects.map((item) => `effect_unknown:${item}`));
  blockers.push(...missingRollback.map((item) => `rollback_coverage_missing:${item}`));

  const candidate = {
    contract_version: SHADOW_DIFFERENTIAL_CONTRACT_VERSION,
    id: `shadow.${baseline.id}.${plan.id}`,
    baseline_digest: baseline.digest,
    plan_digest: plan.digest,
    simulation_trace_digest: simulation.trace_digest,
    zero_write_proven: true as const,
    mandatory_closure: {
      required_step_ids: requiredStepIds,
      matched_step_ids: sortedUnique(matchedStepIds),
      missing_step_ids: missingStepIds
    },
    scope_delta: {
      unexpected_component_instances: unexpectedComponentInstances,
      unexpected_operations: unexpectedOperations,
      unexpected_capabilities: unexpectedCapabilities
    },
    effect_analysis: {
      declared_effects: declaredEffects,
      unknown_effects: unknownEffects,
      program_digests: sortedUnique(programs.map((item) => item.digest))
    },
    rollback_coverage: {
      required_step_ids: rollbackRequired,
      covered_step_ids: coveredSteps,
      missing_step_ids: missingRollback
    },
    verdict: blockers.length ? "blocked" as const : "passed" as const,
    blockers: sortedUnique(blockers),
    activation_allowed: false as const,
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
