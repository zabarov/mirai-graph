# Implementation Control

Status: initial public standard note

## Purpose

Implementation control defines how Mirai Graph represents governed movement from
project knowledge to implementation action without confusing generated context,
feedback, proposals, approvals and canonical state.

## Control Loop

```text
implementation baseline
-> generated projection view
-> semantic review
-> launch gate
-> workflow batch
-> evidence pack
-> sync proposal
-> approval gate
-> controlled update
-> drift check
-> updated baseline
-> improvement item
```

## Rules

- Generated context is not authorization.
- Human feedback is not an automatic canonical update.
- Implementation evidence is not proof of approval.
- A sync proposal must remain separate from an approved update.
- Canonical updates require explicit governance gates.
- `ready_to_execute` and `ready_to_code` are not `executed` or `implemented`.
- Bounded work batches require a launch gate before writes or runtime actions.
- Implementation state promotion requires evidence and drift review.
- Public transfer requires public-safety review and synthetic examples unless
  the source material is already public.

## Relationship To Project Management

Use `project-management` for goals, tasks, milestones, stakeholder coordination,
ordinary decisions and high-level risks.

Use `implementation-control` when the work crosses a control boundary:
generated context becomes a human projection, a plan becomes a bounded work
batch, evidence becomes an approval candidate, or feedback becomes a proposal
for canonical graph change.

The implementation-control profile is therefore stricter than ordinary project
management. It models authorization boundaries, evidence boundaries, drift
checks and controlled updates.

## Cycles

Reusable implementation-control cycles are documented in:

```text
standard/implementation-control-cycles.md
```

## Launch Records

Launch records are bounded authorization artifacts for executable work
batches. They are documented in:

```text
standard/launch-record.md
```

A launch record is not implementation proof, release approval or a canonical
update.

## Process Control Contracts

Executable process-control contracts bind cycles, state machines, launch-record
policy, evidence, recovery, risk controls, validators and Kaizen closure. They
are documented in:

```text
standard/process-control-contract.md
```

## Profile

Machine-readable profile:

```text
profiles/implementation-control/profile.json
```

## Schema

The initial loop schema is documented at:

```text
schemas/implementation-control-loop.schema.json
```

It validates the shape of a loop result, not the semantic truth of the
implementation.
