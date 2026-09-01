# Immutable Activation Model

Status: Mirai 2.1 development contract.

The Graph Context Resolver accepts an event, goal, scope and fixed graph snapshot. It selects applicable relation facts, operation bindings, dependencies, blocked paths, capabilities, approvals and budgets, then emits an immutable activation plan.

The plan is digest-bound to the graph snapshot and policy. It contains an explicit dependency DAG and a deterministic order. Supported join policies are `all`, `collect`, `any_success_ordered` and `quorum`.

Parallel branches do not share mutable state. Completion timing cannot decide merge order. Runtime executes referenced Mirai Programs, not graph nodes directly. An active plan cannot be changed by later canonical graph updates.
