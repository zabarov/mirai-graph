# Content Workflow Package

The workflow package manages draft, review, approved and published states.
Every state transition must store actor, timestamp, previous state, next state
and reason.

Open issue: publication approval should trigger notifications, but only after
audit events are persisted.
