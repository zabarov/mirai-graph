# Mirai Outcome Completion

Status: Mirai 2.5 alpha core extension

## Purpose

Outcome Completion checks whether the user received the useful result required
by the task, rather than treating search output, tool activity or passing tests
as completion.

```text
intent
-> outcome contract
-> candidates and evidence
-> deterministic assessment
-> semantic delivery plan
-> episode and feedback
```

## Core Rules

- A candidate is never an accepted fact.
- A retrieval answer is not business acceptance or execution authorization.
- Every confirmed evidence-required slot must bind to authorized evidence of
  sufficient authority and freshness.
- Critical conflicts block completion and remain visible.
- Missing user input produces a bounded clarifying question.
- A partial result is valid only when the contract allows it and the confirmed
  part remains useful.
- Assessment and delivery never grant capabilities, approvals or canonical
  writes.
- Equal inputs, contract and evidence snapshots produce the same assessment
  digest.

## Statuses

`out_of_scope` has priority over result quality. Critical conflicts produce
`blocked_by_conflict`. Missing user parameters produce `needs_input`. Missing,
stale, unsupported or unauthorized evidence produces
`insufficient_evidence`. Temporary provider failure remains
`temporarily_unavailable`. Complete critical and required slots produce
`satisfied`; an allowed useful subset produces `partially_satisfied`.

`handoff_required` preserves confirmed slots for the next owner. `failed` is
reserved for non-temporary assessment failure, not ordinary missing evidence.

## Composition

Mirai Program calls the pure operations `outcome.instantiate`,
`outcome.bind_candidates`, `outcome.assess`, `outcome.aggregate` and
`outcome.plan_delivery`. Existing `branch`, `match`, `parallel`, `await`,
`retry`, `timeout`, `emit` and `return` nodes provide control flow. No new
language construct or runtime is required.

Nested task graphs aggregate child assessments only when their digests and
parent contract binding validate. An incomplete child cannot be silently
treated as accepted. A child contract binds through `parent_contract_digest`;
same-contract aggregation remains supported for compatibility. Child failure,
temporary unavailability, handoff, conflict, missing input or insufficient
evidence propagates to the aggregate instead of being hidden by another
successful child.

## Boundaries

Outcome Completion is general infrastructure, not a profile. Domain adapters
own channel formatting and business rules. Owner systems retain detailed facts
under Hybrid SOT. Feedback and corrections are proposals until governed review.
