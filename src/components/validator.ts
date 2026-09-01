import type {
  ComponentPackage,
  ComponentValidationResult,
  ContextualBinding,
  RelationFact
} from "./types.js";

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated].sort();
}

function conditionKey(binding: ContextualBinding): string {
  return JSON.stringify(Object.fromEntries(Object.entries(binding.conditions || {}).sort()), null, 0);
}

export function validateComponentPackage(pkg: ComponentPackage): ComponentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!pkg || pkg.contract_version !== "1.0.0") errors.push("unsupported_component_contract");
  if (pkg?.canonical_write_allowed !== false) errors.push("canonical_write_must_be_false");
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["interface", pkg?.interfaces || []], ["operation", pkg?.operation_contracts || []],
    ["component_type", pkg?.component_types || []], ["component_instance", pkg?.component_instances || []],
    ["implementation", pkg?.program_implementations || []], ["binding", pkg?.contextual_bindings || []]
  ];
  for (const [kind, values] of collections) for (const id of duplicates(values.map((item) => item.id))) errors.push(`duplicate_${kind}:${id}`);

  const interfaces = new Map((pkg?.interfaces || []).map((item) => [item.id, item]));
  const operations = new Map((pkg?.operation_contracts || []).map((item) => [item.id, item]));
  const types = new Map((pkg?.component_types || []).map((item) => [item.id, item]));
  const implementations = new Map((pkg?.program_implementations || []).map((item) => [item.id, item]));

  for (const item of pkg?.interfaces || []) for (const operation of item.operations) if (!operations.has(operation)) errors.push(`interface_unknown_operation:${item.id}:${operation}`);
  for (const item of pkg?.component_types || []) {
    for (const interfaceId of item.implements) {
      const contract = interfaces.get(interfaceId);
      if (!contract) errors.push(`component_unknown_interface:${item.id}:${interfaceId}`);
      else for (const operation of contract.operations) if (!item.exposes.includes(operation)) errors.push(`interface_operation_not_exposed:${item.id}:${operation}`);
    }
    for (const operation of item.exposes) if (!operations.has(operation)) errors.push(`component_unknown_operation:${item.id}:${operation}`);
    for (const composed of item.composes) if (!types.has(composed)) errors.push(`component_unknown_composition:${item.id}:${composed}`);
  }
  for (const instance of pkg?.component_instances || []) if (!types.has(instance.instance_of)) errors.push(`instance_unknown_type:${instance.id}:${instance.instance_of}`);
  for (const implementation of pkg?.program_implementations || []) {
    if (!operations.has(implementation.operation)) errors.push(`implementation_unknown_operation:${implementation.id}:${implementation.operation}`);
    if (!/^sha256:[a-f0-9]{64}$/.test(implementation.program_digest)) errors.push(`implementation_invalid_digest:${implementation.id}`);
  }
  for (const binding of pkg?.contextual_bindings || []) {
    const component = types.get(binding.component_type);
    const implementation = implementations.get(binding.implementation);
    if (!component) errors.push(`binding_unknown_component:${binding.id}:${binding.component_type}`);
    if (!implementation) errors.push(`binding_unknown_implementation:${binding.id}:${binding.implementation}`);
    if (component && !component.exposes.includes(binding.operation)) errors.push(`binding_operation_not_exposed:${binding.id}:${binding.operation}`);
    if (implementation && implementation.operation !== binding.operation) errors.push(`binding_operation_mismatch:${binding.id}`);
  }
  const dispatchGroups = new Map<string, ContextualBinding[]>();
  for (const binding of pkg?.contextual_bindings || []) {
    const key = [binding.component_type, binding.operation, binding.scope || "*", conditionKey(binding), binding.priority].join("|");
    const values = dispatchGroups.get(key) || [];
    values.push(binding);
    dispatchGroups.set(key, values);
  }
  for (const values of dispatchGroups.values()) if (values.length > 1) errors.push(`ambiguous_dispatch:${values.map((item) => item.id).sort().join(",")}`);
  return { valid: errors.length === 0, errors: errors.sort(), warnings };
}

export function validateRelationFact(fact: RelationFact): ComponentValidationResult {
  const errors: string[] = [];
  if (!fact || fact.contract_version !== "1.0.0") errors.push("unsupported_relation_fact_contract");
  if (!fact?.id || !fact?.type) errors.push("relation_fact_identity_required");
  if (!Array.isArray(fact?.participants) || fact.participants.length < 2) errors.push("relation_fact_requires_two_participants");
  if (new Set((fact?.participants || []).map((item) => item.role)).size !== (fact?.participants || []).length) errors.push("relation_participant_roles_must_be_unique");
  if (!Number.isInteger(fact?.priority)) errors.push("relation_priority_must_be_integer");
  if (typeof fact?.confidence !== "number" || fact.confidence < 0 || fact.confidence > 1) errors.push("relation_confidence_out_of_range");
  if (!Array.isArray(fact?.provenance) || fact.provenance.length === 0) errors.push("relation_provenance_required");
  if (fact?.valid_from && fact?.valid_until && Date.parse(fact.valid_from) > Date.parse(fact.valid_until)) errors.push("relation_temporal_range_invalid");
  return { valid: errors.length === 0, errors: errors.sort(), warnings: [] };
}

export function relationApplies(fact: RelationFact, context: { now: string; scope?: string; values?: Record<string, unknown>; signal_type?: string }): boolean {
  if (!validateRelationFact(fact).valid) return false;
  const now = Date.parse(context.now);
  if (!Number.isFinite(now)) return false;
  if (fact.valid_from && now < Date.parse(fact.valid_from)) return false;
  if (fact.valid_until && now > Date.parse(fact.valid_until)) return false;
  if (fact.scope && fact.scope !== context.scope) return false;
  if (fact.activation_rule?.signal_type && fact.activation_rule.signal_type !== context.signal_type) return false;
  for (const [key, expected] of Object.entries(fact.conditions || {})) if (context.values?.[key] !== expected) return false;
  return true;
}
