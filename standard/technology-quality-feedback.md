# Technology Quality Feedback

Status: initial public standard note

## Purpose

Technology quality feedback checks whether completed work followed the declared
technology, process or method before that work can be accepted, released or
used as evidence for canonical change.

It exists because passing tests, producing artifacts or collecting evidence can
still hide process drift. A team needs a separate review loop that asks:

```text
Did the work follow the technology it claimed to follow?
```

## Core Pattern

```text
technology contract
-> work evidence
-> technology quality feedback
-> finding classification
-> transition decision
-> Kaizen / proposal / fix route
```

The feedback report is a gate artifact. It classifies findings and routes the
next transition, but it does not execute actions or update canonical state.

## Required Rules

- Passing tests do not mean accepted work.
- Evidence does not authorize release or canonical update.
- Generated context and proposals do not mutate canonical state.
- Every finding must be classified.
- `process_improvement` findings route to Kaizen.
- `spec_gap` findings route back to planning, human review or graph sync
  proposal.
- Blocking findings stop acceptance and release transitions.

## Classifications

Public GrowGraph uses universal classifications:

- `accepted`;
- `work_fix_required`;
- `test_gap`;
- `spec_gap`;
- `graph_update_proposal`;
- `process_improvement`;
- `release_blocker`;
- `security_blocker`;
- `defer_with_reason`.

Domain adapters may map narrower terms to these values. For example, a
software-code review adapter may map `code_fix_required` to
`work_fix_required`.

## Review Dimensions

A feedback report should choose dimensions that match the technology being
checked. Common dimensions include:

- scope;
- architecture;
- ownership;
- security;
- runtime;
- tests;
- evidence;
- graph_drift;
- release;
- process_adherence.

## Transition Boundary

Technology feedback can support a process transition such as `review_ready`,
`accepted`, `approved` or `released`. It must not be treated as the transition
itself.

Significant work should enter acceptance or release states only when the
process-control contract requires and receives a passing technology quality
feedback report.

## Schema

Machine-readable feedback reports can be validated with:

```text
schemas/technology-quality-feedback.schema.json
```

The schema validates public shape, finding classification and boundary rules.
It does not prove semantic correctness, production safety or scientific
effectiveness.
