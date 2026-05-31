# Runtime Enablement

Status: alpha standard section

## Purpose

GrowGraph can generate context for humans, agents and software runtimes. Runtime
enablement defines when graph-mode may be used as the primary context layer for
a specific task.

This section generalizes the boundary:

```text
generated context != authorization
runtime decision != executed action
feedback != canonical update
```

## Runtime Question

The runtime gate answers one narrow question:

```text
Can this specific task use graph-mode as the primary context layer?
```

It does not answer whether the task should be executed, whether the graph should
be rewritten, or whether the generated context is complete.

## Runtime Modes

- `blocked`: graph-mode must not be used for the task.
- `fallback_required`: graph-mode may help, but raw sources, runbooks or
  approvals are mandatory.
- `graph_context_allowed`: graph-mode can be the primary context for the
  declared measured scope.
- `no_match`: no policy covers the requested task.

## Safe Defaults

Implementations should use these defaults:

- compact context first;
- broader context only when justified by evidence;
- no canonical writes through runtime policy;
- raw-source fallback for sensitive work;
- gap recording when graph coverage is missing.

## Mandatory Fallback Triggers

Fallback should be required for:

- unmeasured scenarios;
- destructive actions;
- production or live infrastructure;
- credentials, secrets or private data;
- legal, commercial or financial risk;
- customer-visible writes;
- irreversible changes;
- safety-critical operations.

## Runtime Preflight

A runtime preflight artifact should include:

- task;
- target object or profile;
- selected context profile;
- status;
- required fallbacks;
- blocking gaps;
- generated context references;
- raw source references that must still be read;
- limitations.

## Limited Claim

Passing a runtime enablement gate supports this limited claim:

```text
Graph-mode may be used as the primary context layer for the declared task and
scope, subject to recorded fallbacks and limitations.
```

It does not authorize execution or canonical graph updates.
