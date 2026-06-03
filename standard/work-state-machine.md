# Work State Machine

Status: initial public standard note

## Purpose

Work state machines define allowed movement through a governed work lifecycle.
They prevent false promotion from planning readiness to execution, from written
work to implemented state, or from proposal to canonical update.

## Core States

Typical state sequence:

```text
planned
-> launch_ready
-> prepared
-> ready_to_execute
-> started
-> written
-> tests_recorded
-> evidence_recorded
-> sync_proposed
-> review_ready
-> changes_requested
-> approved
-> release_ready
-> released
-> feedback_recorded
-> evolution_proposed
```

Exceptional states:

- `blocked`
- `paused`
- `abandoned`
- `superseded`
- `reverted`
- `recovered`

## Critical Rules

- `ready_to_execute` is not `started`.
- `ready_to_code` is not `implemented`.
- `written` is not accepted implementation state.
- `tests_recorded` without semantic evidence is not review acceptance.
- `sync_proposed` does not update canonical graph state.
- invalid transitions fail closed.
- transitions may require a launch record when they cross from planning into
  executable work.
- terminal states require a Kaizen review or an explicit no-reusable-lessons
  reason when the process is significant.

## Schema

Machine-readable state machines can be validated with:

```text
schemas/work-state-machine.schema.json
```
