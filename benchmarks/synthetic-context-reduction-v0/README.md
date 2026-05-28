# Synthetic GrowGraph Benchmark v0

Status: draft synthetic package for public-method inspection

This package is artificial. It does not contain private project, customer, employee, source-chat or private skill material.

## Purpose

The package demonstrates the structure of the GrowGraph context-selection
method on a small synthetic software-specification scenario.
It is intended for public inspection of the method, not for empirical claims
about external performance.

## Scenario

A fictional modular publishing platform is planning four related packages:

- identity and access;
- content workflow;
- audit events;
- notification delivery.

Feature notes, graph objects, relations and context-selection tasks are
provided as small files that mimic the shape of an evolving specification
workspace.

## Files

- `source-corpus/`: synthetic source notes.
- `graph/objects.json`: graph objects extracted from the source corpus.
- `graph/relations.json`: typed relations between graph objects.
- `tasks/tasks.json`: sample context-selection tasks.
- `expected/context-pack-compact.md`: expected compact context package for one
  task.
- `metrics/example-metrics.json`: illustrative metric calculation.
- `scripts/calculate-context-reduction.js`: repeatable calculation for the
  illustrative synthetic metric.

The graph files are normalized to the initial GrowGraph v0.1 draft object and
relation shape.

## Limits

This package supports reproducibility of the method structure only. It does not
validate semantic completeness, external generalization, agent safety or task
success.

## Example Calculation

Run from this package directory:

```bash
node scripts/calculate-context-reduction.js
```

Expected result:

```json
{
  "task_id": "task.notify_after_approval",
  "baseline_context_units": 620,
  "graph_context_units": 270,
  "total_reduction_percent": 56.4516,
  "note": "Synthetic demonstration only; do not merge with internal empirical metrics."
}
```
