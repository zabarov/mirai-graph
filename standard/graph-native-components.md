# Graph-Native Components

Status: Mirai 2.1 development contract.

A component is a governed graph unit with typed operations and explicit program implementations.

- `component_interface` declares required operations.
- `operation_contract` declares typed inputs, outputs and capabilities.
- `component_type` implements interfaces, exposes operations and composes other component types.
- `component_instance` binds a component type to a scope.
- `program_implementation` binds an operation to an immutable Mirai Program digest.
- `contextual_binding` selects an implementation under explicit scope, conditions and priority.

Behavior is reused through composition and explicit binding. `specializes` may describe semantic specialization, but never copies behavior automatically. Equal-priority applicable bindings fail with `ambiguous_dispatch`.
