# Action Runtime Boundary

Status: alpha standard draft

## Purpose

This section defines the boundary between Mirai Graph canonical state and
action-capable runtime behavior.

The boundary is required for AI employees, automation systems and any
Mirai Graph implementation that can affect external systems.

## State Sequence

Action-capable implementations should preserve this sequence:

```text
canonical graph state
-> generated context
-> runtime decision
-> proposed action
-> approval gate
-> executed action
-> audited result
```

## Canonical Graph State

Canonical graph state is the source of truth for durable objects, relations,
policies, evidence, readiness and governance records.

It may say that an AI employee has a role, can use a tool or follows a policy.
It does not prove that a particular runtime action should execute now.

## Generated Context

Generated context is a task-bounded view derived from canonical state.

It helps a human or AI system reason about a task. It is not authorization.

## Runtime Decision

A runtime decision is a transient conclusion produced by an implementation.

It may recommend an action, escalation, delegation or no-op. It should record
the context, policy and evidence it used.

## Proposed Action

A proposed action describes what the runtime wants to do before execution.

It should include:

- action id;
- actor;
- target system or object;
- required capability;
- applicable policy;
- approval requirement;
- expected result;
- rollback or recovery note when relevant.

## Approval Gate

An approval gate decides whether a proposed action may execute.

Approval may be automatic for low-risk actions when policy allows it. It should
be explicit for external, irreversible, sensitive, permission-changing or
public-facing actions.

## Executed Action

An executed action records that a runtime operation actually happened.

It should not be represented only as an intended task. It needs execution
evidence, timestamp or version reference, status and actor/runtime identity
where available.

## Audited Result

An audited result records the observed outcome and whether it matched the
expected result.

Results may produce feedback, lessons, risks or follow-up actions. They should
not silently update canonical behavior without a learning gate.

## Minimum Safety Rule

```text
generated context != authorization
runtime decision != executed action
feedback != canonical update
```

## Implementation Note

Mirai Graph can model this boundary. The runtime implementation remains
responsible for authentication, authorization, tool sandboxing, retries,
timeouts, logging, rollback and operational security.
