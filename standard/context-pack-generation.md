# GrowGraph Context-Pack Generation

Status: initial public draft

## Purpose

Context-pack generation defines how a GrowGraph implementation produces
task-specific working context from canonical graph state.

A generated context pack helps a human or AI assistant perform a task. It does
not replace canonical graph state.

## Context Pack

A context pack is a task-bounded view of the graph.

It should include:

- task id or task description;
- included objects;
- included relations;
- evidence references;
- assumptions;
- omissions or excluded context;
- generation method;
- timestamp or version reference;
- limitations.

## Minimum Context-Pack Metadata

```json
{
  "id": "context_pack.notify_after_approval",
  "task_id": "task.notify_after_approval",
  "source_graph": "growgraph-package.json",
  "generated_at": "2026-05-28",
  "included_objects": [],
  "included_relations": [],
  "evidence": [],
  "limitations": []
}
```

## Generation Flow

```text
task -> select relevant objects -> select relevant relations
     -> include evidence references -> record omissions
     -> generate context pack -> review/use for task
```

## Selection Rules

A context pack should include:

- objects directly required by the task;
- relations needed to understand dependencies and blockers;
- evidence supporting included claims;
- governance gates relevant to the task;
- known risks or limitations.

A context pack should exclude:

- unrelated graph areas;
- private material outside the task boundary;
- deprecated objects unless needed for historical context;
- generated claims not accepted into canonical state.

## Evidence Preservation

Generated context should preserve evidence references. If a context pack
summarizes an object, it should still identify the source object and evidence
ids.

## Omissions

Omissions are part of responsible context generation.

Each non-trivial context pack should state:

- what was excluded;
- why it was excluded;
- whether exclusion creates risk;
- when a broader context review is needed.

## Generated Context Is Not Canonical State

Generated context packs may be reviewed and then used as evidence or source
material for graph updates. They do not automatically mutate canonical graph
state.

## Anti-Patterns

- Treating a generated context pack as the graph.
- Removing evidence references during summarization.
- Using one task pack for a different task without review.
- Omitting governance gates to make a task easier.
- Generating public context from private material without a release gate.
