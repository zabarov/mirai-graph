import { digestValue, withoutDigest } from "../core/index.js";
import type { OutcomeCompletionContract, OutcomeValidationResult } from "./types.js";

const idPattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/;

export function validateOutcomeContract(contract: OutcomeCompletionContract): OutcomeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!contract || contract.contract_version !== "1.0.0") errors.push("unsupported_contract_version");
  if (!idPattern.test(contract?.id || "")) errors.push("invalid_contract_id");
  if (!contract?.goal?.trim()) errors.push("goal_required");
  if (!contract?.scope?.purpose || !contract.scope.domains?.length) errors.push("scope_required");
  if (contract?.canonical_write_allowed !== false) errors.push("canonical_write_must_be_false");
  if (contract?.execution_allowed !== false) errors.push("execution_allowed_must_be_false");
  if (contract?.template_authority === "ephemeral_read_only" && contract.scope.effect !== "read_only") errors.push("ephemeral_contract_must_be_read_only");
  const slots = [...(contract?.required_slots || []), ...(contract?.optional_slots || [])];
  const ids = slots.map((slot) => slot.id);
  if (new Set(ids).size !== ids.length) errors.push("duplicate_slot_id");
  if (contract?.required_slots?.some((slot) => !slot.critical) && contract.completion_policy?.all_critical_required) warnings.push("required_noncritical_slot_allows_partial_only");
  if (!contract?.digest || contract.digest !== digestValue(withoutDigest(contract as unknown as Record<string, unknown>))) errors.push("contract_digest_mismatch");
  return { valid: errors.length === 0, errors, warnings };
}

export function assertOutcomeContract(contract: OutcomeCompletionContract): void {
  const result = validateOutcomeContract(contract);
  if (!result.valid) throw new Error(result.errors.join(","));
}
