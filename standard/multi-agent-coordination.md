# Multi-Agent Coordination

Status: 1.0 release-candidate standard section

## Purpose

Multi-agent coordination defines how several humans, agents or services can
work on one graph-governed system without duplicating ownership, overwriting
canonical state or creating hidden coupling.

## Coordination Principle

Parallel work is allowed only when each worker has:

- a reservation;
- a bounded scope;
- an execution branch or workspace;
- allowed files or allowed actions;
- evidence path;
- proposal path;
- coordinator ownership;
- conflict-resolution rule.

No worker should own canonical graph writes by default.

## Coordination Objects

- coordination contract;
- work reservation;
- branch or workspace reservation;
- evidence pack;
- sync proposal;
- review result;
- approval or release decision.

## Locking Rules

- one active owner per bounded execution scope;
- no parallel canonical updates without coordinator review;
- cross-scope changes require impact analysis before execution;
- conflicting proposals are resolved by coordinator decision;
- reservations must be releasable, supersedable or recoverable.

## Schema

Machine-readable coordination contracts can be validated with:

```text
schemas/multi-agent-coordination.schema.json
```
