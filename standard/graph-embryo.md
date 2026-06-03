# Mirai Graph Embryo

Status: initial public draft

## Purpose

A Graph Embryo is the first candidate graph state generated from a Graph Seed.

It is reviewable and disposable until accepted. It should be small enough for
human review and structured enough to show the likely growth direction.

## Definition

A Graph Embryo contains candidate graph elements before canonical write:

- candidate objects;
- candidate relations;
- uncertain objects;
- missing evidence;
- rejected or deferred candidates;
- review questions;
- growth-gap notes.

## Relationship To Canonical State

The embryo is not canonical state.

Flow:

```text
Graph Seed -> Graph Embryo -> Review -> Accepted Canonical Graph State
```

Only reviewed and accepted candidates should move into canonical graph state.

## Minimum Embryo Metadata

```json
{
  "schema_version": "0.1.0",
  "embryo_id": "embryo.example",
  "seed_id": "seed.example",
  "generated_at": "2026-05-28",
  "candidate_objects": [],
  "candidate_relations": [],
  "uncertain_items": [],
  "review_questions": [],
  "stop_conditions_triggered": []
}
```

## Review Questions

A useful embryo should help reviewers answer:

- Which candidate objects belong in the graph?
- Which candidates should be rejected or deferred?
- Which relations are unsupported?
- Which evidence is missing?
- Which stop conditions were triggered?
- What should be accepted into canonical state?

## Anti-Patterns

- Treating the embryo as accepted graph state.
- Generating too many candidates for practical review.
- Hiding uncertain or rejected candidates.
- Dropping evidence gaps.
- Using embryo output as runtime context before review.
