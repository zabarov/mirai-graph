import Ajv2020 from "ajv/dist/2020.js";
import { digestValue } from "../core/canonical.js";
import { resolveActivationPlan } from "../activation/resolver.js";
import type { ActivationGraphSnapshot, ActivationSignal } from "../activation/types.js";
import { COMPONENT_PACKAGE_SCHEMA } from "../components/schema.js";
import { validateComponentPackage } from "../components/validator.js";
import type { ComponentPackage } from "../components/types.js";
import { requireCondition, requireJson, seal } from "./graph.js";

const shape = new Ajv2020({ strict: false }).compile<ComponentPackage>(COMPONENT_PACKAGE_SCHEMA);
function validate(pkg: unknown): asserts pkg is ComponentPackage {
  requireJson(pkg);
  requireCondition(shape(pkg), "component_shape_invalid");
  requireCondition(validateComponentPackage(pkg).valid, "component_semantics_invalid");
  requireCondition([pkg.component_instances, pkg.component_types, pkg.contextual_bindings, pkg.operation_contracts, pkg.program_implementations, pkg.interfaces].every(items => items.length <= 1000), "component_inventory_budget_exceeded");
}

export function describeComponent(pkg: ComponentPackage, instanceId: string) {
  validate(pkg);
  const instance = pkg.component_instances.find(x => x.id === instanceId);
  requireCondition(instance, "component_instance_unknown");
  const component = pkg.component_types.find(x => x.id === instance.instance_of)!;
  return seal({ contract_version: "1.0.0", package_digest: digestValue(pkg), instance: structuredClone(instance),
    component: structuredClone(component), operations: structuredClone(pkg.operation_contracts.filter(x => component.exposes.includes(x.id))), canonical_write_allowed: false });
}

export function resolveComponentOperations(snapshot: ActivationGraphSnapshot, signal: ActivationSignal) {
  requireJson(snapshot); requireJson(signal); validate(snapshot.components);
  const requested = signal.component_refs;
  const ids = new Set(snapshot.components.component_instances.filter(x => x.scope === signal.scope).map(x => x.id));
  requireCondition(requested && requested.length > 0 && new Set(requested).size === requested.length && requested.every(id => ids.has(id)), "component_scope_or_selection_invalid");
  // The existing resolver remains the single dispatch implementation.
  return resolveActivationPlan(snapshot, signal);
}
