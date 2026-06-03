# Process Control Contract

Status: initial public standard note

## Purpose

A process-control contract binds implementation-control cycles to executable
state machines, launch-record policy, evidence requirements, recovery behavior,
risk controls, validators and Kaizen policy.

It is the public GrowGraph bridge between standards and fail-closed process
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
- evidence references;
- limitations.

## Boundary

The contract validates process movement. It must not execute destructive
actions, grant release approval, perform canonical updates or treat generated
context as authorization.

## Schema

Machine-readable contracts can be validated with:

```text
schemas/process-control-contract.schema.json
```
