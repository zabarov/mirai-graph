# Graph DNA Alignment

Status: initial public standard note

## Purpose

Graph DNA alignment keeps components, work batches, generated projections and
runtime feedback aligned with the larger system purpose.

It prevents local optimization: a component can be internally detailed but still
harm the parent graph if it owns the wrong scope, violates invariants or drifts
from the evolution vector.

## Core Pattern

```text
parent DNA
-> component DNA
-> ownership boundary
-> invariants
-> anti-patterns
-> success criteria
-> alignment result
```

## Minimum Concepts

- parent system DNA: mission, evolution vector and non-negotiable principles;
- component DNA: why the component exists and what value it creates;
- owns: responsibilities the component is allowed to own;
- must not own: responsibilities that must stay elsewhere;
- invariants: properties that must remain true during change;
- anti-patterns: recurring shapes that indicate drift;
- success criteria: observable evidence that the component serves the parent.

## Rules

- A component must not redefine the parent system direction.
- A component that conflicts with parent DNA needs a proposal or a blocker.
- Generated projections can reveal DNA gaps but cannot change DNA by
  themselves.
- Implementation work should load relevant DNA before crossing a launch gate.

## Schema

Machine-readable alignment results can be validated with:

```text
schemas/graph-dna-alignment.schema.json
```
