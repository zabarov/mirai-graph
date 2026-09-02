# ADR: Mirai 2.2 Autonomic Fabric

Status: accepted development decision

## Context

Mirai 2.1 can scan files and Git, create assimilation proposals, compile
reviewed technology drafts, resolve immutable activation plans and execute
capability-gated Programs. It does not yet provide a universal connector
protocol, incremental source reconciliation, managed adaptive promotion or a
continuous bounded control loop.

## Decision

Mirai 2.2 adds four composable modules:

- Sources: transport-neutral read providers and format converters.
- Knowledge: identity, provenance, conflict and lifecycle organization.
- Autonomy: trust strata, autonomy envelopes and evolution decisions.
- Evolution: deterministic reconcile cycles and promotion receipts.

Program `1.0.0`, Runtime `1.0.0` and Project Capsule 2.1 remain valid.

## Separation Of Concerns

Source connectors read external systems. They never perform external writes.
Runtime adapters own effects. Knowledge proposals own meaning. Autonomy
envelopes own pre-authorized adaptive scope. Host policy verifies the envelope
and the runtime or deployment contour remains responsible for real-world
effects.

## Managed Autonomy

Automatic promotion is deliberately narrow. It may update derived navigation,
freshness, reviewed aliases, non-authoritative statistics and effect-free
Programs that pass deterministic replay. Everything else remains manual.

## Consequences

- A project can be living without allowing uncontrolled self-modification.
- Provider and converter packages can evolve independently.
- Reconciliation is replayable because every decision is snapshot-bound.
- The system retains additional contracts and evidence, but avoids copying
  bulk source content into the graph.
