# Risk Control Matrix

Status: initial public standard note

## Purpose

A risk control matrix maps known risks to detection signals, prevention
mechanisms, gates, evidence requirements, recovery actions, escalation rules
and owner roles.

It is designed for graph-governed projects where AI-assisted or multi-agent work
can otherwise create false readiness, source-of-truth drift, unsafe runtime
behavior or conflicting changes.

## Required Shape

Every risk row should include:

- risk id and description;
- severity;
- detection signal;
- prevention mechanism;
- gate or validator;
- evidence requirement;
- recovery action;
- escalation rule;
- owner role.

## Severity Model

- `critical`: can compromise safety, source of truth, ownership or release.
- `high`: can break architecture, boundaries or implementation claims.
- `medium`: can cause rework, stale planning or evidence gaps.
- `low`: can confuse review without blocking work by itself.

## Default Recovery Pattern

```text
stop writes
-> capture current state
-> identify last good checkpoint
-> classify risk
-> restore scope or evidence
-> escalate if ownership is unclear
```

## Schema

Machine-readable risk matrices can be validated with:

```text
schemas/risk-control-matrix.schema.json
```
