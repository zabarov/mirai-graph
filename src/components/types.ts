import type { TypeSpec } from "../program/types.js";

export const COMPONENT_CONTRACT_VERSION = "1.0.0" as const;
export const RELATION_FACT_CONTRACT_VERSION = "1.0.0" as const;

export interface OperationContract {
  id: string;
  inputs: Array<{ id: string; type: TypeSpec; required?: boolean }>;
  outputs: Array<{ id: string; type: TypeSpec; required?: boolean }>;
  required_capabilities: string[];
}

export interface ComponentInterface {
  id: string;
  operations: string[];
}

export interface ComponentType {
  id: string;
  implements: string[];
  exposes: string[];
  composes: string[];
  state_contract?: string;
}

export interface ComponentInstance {
  id: string;
  instance_of: string;
  scope: string;
}

export interface ProgramImplementation {
  id: string;
  operation: string;
  program_ref: string;
  program_digest: string;
}

export interface ContextualBinding {
  id: string;
  component_type: string;
  operation: string;
  implementation: string;
  priority: number;
  scope?: string;
  conditions?: Record<string, string | number | boolean>;
}

export interface ComponentPackage {
  contract_version: typeof COMPONENT_CONTRACT_VERSION;
  interfaces: ComponentInterface[];
  operation_contracts: OperationContract[];
  component_types: ComponentType[];
  component_instances: ComponentInstance[];
  program_implementations: ProgramImplementation[];
  contextual_bindings: ContextualBinding[];
  canonical_write_allowed: false;
}

export interface RelationParticipant {
  ref: string;
  role: string;
}

export interface RelationFact {
  contract_version: typeof RELATION_FACT_CONTRACT_VERSION;
  id: string;
  type: string;
  participants: RelationParticipant[];
  qualifiers?: Record<string, string | number | boolean>;
  scope?: string;
  conditions?: Record<string, string | number | boolean>;
  valid_from?: string;
  valid_until?: string;
  priority: number;
  authority: "canonical" | "owner_asserted" | "derived" | "proposal";
  confidence: number;
  provenance: Array<{ source_ref: string; evidence_ref?: string }>;
  activation_rule?: { signal_type: string; operation?: string };
}

export interface ComponentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
