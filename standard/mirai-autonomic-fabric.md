# Mirai Autonomic Fabric

Status: `2.2.0` development contract

## Purpose

Mirai Autonomic Fabric is the governed control loop that turns heterogeneous
sources into provenance-bound knowledge, process candidates, executable Mirai
Programs and bounded evolution decisions.

```text
sources -> snapshots -> normalized units -> assertions -> relation facts
-> process candidates -> technology drafts -> programs -> episodes
-> evolution proposals -> governed promotion
```

It extends Mirai 2.1. It does not replace Graph Core, Program, Runtime,
Project Capsule or Hybrid SOT.

## Invariants

- Source providers are read-only. External writes remain Runtime effects.
- Raw owner data remains in its authoritative system.
- Generated assertions and observed process patterns are proposals.
- Source authority, extraction confidence, corroboration and freshness are
  separate dimensions.
- Intended technology and observed practice are never silently merged.
- Active execution remains bound to immutable graph, program and policy
  digests.
- Automatic promotion is restricted to adaptive state by an unexpired,
  host-authorized autonomy envelope.
- Protected invariants, authority, capabilities, approvals, conflicts and
  effectful programs cannot auto-promote.

## Trust Strata

```text
system_protected
organization_protected
governed_canonical
adaptive_canonical
ephemeral
```

Lower strata cannot grant themselves access to a higher stratum. Runtime
evidence and learning proposals cannot change an autonomy envelope.

## Bounded Reconciliation

The reference controller exposes one deterministic `reconcile --once` cycle.
Scheduling belongs to the host. Every cycle uses bounded snapshots, leases,
budgets, idempotency keys and receipts. Mirai does not install a hidden daemon.

## Claim Boundary

Conformance shows that an implementation enforces these contracts for the
tested corpus. It does not prove extracted knowledge is universally correct or
authorize production effects.
