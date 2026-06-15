# Launch Record

Status: 1.0 release-candidate standard section

## Purpose

A launch record is a durable authorization boundary for a bounded work batch.
It says what may be attempted, which state transition is being requested, what
evidence must be produced and when the work must stop.

It is not implementation proof, acceptance evidence, release approval or a
canonical update.

## Required Contract

A launch record must define:

- workflow id;
- process model id;
- cycle id;
- current state and target state;
- allowed and forbidden files or scopes;
- allowed actions;
- required gates;
- required evidence;
- stop conditions;
- owner role;
- user approval flag;
- evidence references;
- limitations.

## Execution Boundary

```text
plan
-> launch record
-> bounded work
-> evidence
-> review
-> approval candidate
```

The launch record permits only the declared work. If scope, owner, state,
evidence requirements or stop conditions change, the launch record must be
updated or replaced before continuing.

## Schema

Machine-readable launch records can be validated with:

```text
schemas/launch-record.schema.json
```
