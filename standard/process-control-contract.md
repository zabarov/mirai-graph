# Process Control Contract

Status: initial public standard note

## Purpose

A process-control contract binds implementation-control cycles to executable
state machines, launch-record policy, evidence requirements, recovery behavior,
risk controls, validators and Kaizen policy.

It is the public Mirai Graph bridge between standards and fail-closed process
validation.

## Required Contract

A process-control contract must define:

- process id;
- cycle id;
- state machine id;
- launch-record policy;
- evidence requirements;
- recovery behavior;
- risk controls;
- validators;
- Kaizen policy;
- technology quality feedback policy when significant work may move into
  acceptance, approval or release states;
- evidence references;
- limitations.

## Boundary

The contract validates process movement. It must not execute destructive
actions, grant release approval, perform canonical updates or treat generated
context as authorization.

Tests and evidence do not prove that the declared technology was followed. For
significant work, the contract should require a technology quality feedback
gate before transitions such as `review_ready`, `accepted`, `approved` or
`released`.

Technology quality feedback classifies process and work findings. It supports
transition decisions, but it does not replace owner approval or canonical
promotion.

## Schema

Machine-readable contracts can be validated with:

```text
schemas/process-control-contract.schema.json
```
