# Implementation Control Cycles Example

Status: synthetic public example

## Purpose

This example demonstrates reusable implementation-control cycles for governed
project movement.

It models:

```text
human projection feedback
-> implementation planning
-> bounded work batch
-> review and evidence
-> release or publish
-> runtime feedback
-> kaizen improvement
-> next transition decision
```

It also models the public-safe continuous-improvement pattern:

```text
cycle completed
-> transition decision
-> kaizen review
-> classified improvement
-> blocking/non-blocking decision
-> next governed cycle
```

The Kaizen cycle is separate from runtime feedback. Runtime feedback captures
operational signals; Kaizen reviews the quality of completed work and the
process that produced it.

The example is synthetic. It does not contain private project data, internal
paths, private policies, private transfer notes or runtime traces.

## Validation

Run:

```bash
npm run validate:implementation-control-cycles
```
