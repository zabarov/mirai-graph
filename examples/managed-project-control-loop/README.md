# Managed Project Control Loop Example

Status: synthetic public example

## Purpose

This example demonstrates how the current GrowGraph `project_management`
profile can represent a managed project loop without introducing new profile
kinds yet.

It models the pattern:

```text
canonical graph baseline
-> generated human projection
-> semantic review
-> graph sync proposal
-> evidence pack
-> coordinator approval gate
-> approved canonical update
```

The example is synthetic. It does not contain private project data, internal
paths, private policies or runtime traces.

## What It Shows

- A human-readable projection is evidence, not canonical truth.
- Semantic review produces a decision and proposal, not an automatic graph
  rewrite.
- Evidence must be collected before a canonical update can be approved.
- A governance gate separates proposed changes from accepted project state.
- The current `project_management` profile can represent this loop with
  `task`, `decision`, `evidence`, `risk`, `milestone` and `governance_gate`
  objects.

## Validation

Run:

```bash
node packages/cli/validate-growgraph.js examples/managed-project-control-loop
```
