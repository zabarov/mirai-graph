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
- Every confirmed evidence-required slot must bind host-admitted evidence to
  the exact contract digest, slot id and candidate value digest. An opaque
  admission receipt identifies the host policy decision; model output cannot
  reuse that admission for a different value.
- Every contract has at least one required critical slot backed by evidence;
  a contract cannot define away the minimum completion proof.
- Serialized evidence cannot admit itself. Assessment requires a verifier
  injected by the host from protected runtime state and bound to the exact
  evidence-set and policy digests. The CLI reads that verifier input only from
  `<MIRAI_HOME>/outcome-admissions.json`; project content and command arguments
  cannot supply it.
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

Nested task graphs aggregate full child bundles containing the child contract,
candidates, admitted evidence and assessment. The parent recomputes every
child assessment before aggregation; a self-consistent assessment JSON is not
trusted by itself. An incomplete child cannot be silently treated as accepted.
A child contract binds through `parent_contract_digest`; same-contract
aggregation remains supported for compatibility. Child failure,
temporary unavailability, handoff, conflict, missing input or insufficient
evidence propagates to the aggregate instead of being hidden by another
successful child.
Child scope, effect, conflict handling, evidence requirement, minimum authority
and freshness may preserve or strengthen the parent contract, but cannot
weaken it.

## Boundaries

Outcome Completion is general infrastructure, not a profile. Domain adapters
own channel formatting and business rules. Owner systems retain detailed facts
under Hybrid SOT. Feedback and corrections are proposals until governed review.
Candidate-derived values remain marked as untrusted data through assessment and
delivery so downstream rendering cannot confuse retrieved text with commands.
Delivery planning accepts only an assessment verified by the host in the same
execution context; a digest-valid assessment file is not sufficient by itself.
