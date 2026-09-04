# ADR: Outcome Completion Is A Core Extension

Status: accepted for `2.5.0-alpha.1` implementation

## Decision

Outcome Completion is an additive core extension. It is not a separate
runtime, profile, response renderer or authority system. Existing Mirai Program
control flow composes pure outcome operations, and the existing Runtime remains
the only effect execution boundary.

The extension separates four things that must not be conflated:

1. `OutcomeCompletionContract` states what useful result is required.
2. `OutcomeCandidateSet` contains untrusted proposed values.
3. `OutcomeAssessment` deterministically admits evidence and classifies gaps.
4. `OutcomeDeliveryPlan` carries semantic content for an adapter to render.

Retrieval supplies evidence; it does not decide business completion. Character
Layer can shape behavior and tone; it does not admit evidence. Product adapters
own domain wording, channels and business-specific rules.

## Safety Boundary

All four contracts set `canonical_write_allowed=false`. Candidate sets,
assessments and delivery plans also set `execution_allowed=false`. They cannot
grant a capability, create an approval or authorize a runtime effect.

An ephemeral contract is allowed only for a read-only low-risk request and is
digest-frozen before retrieval. Effectful or significant work requires an
owner-approved template or a separate approval. A generated template is always
a proposal.

## Compatibility

Mirai Program contract `1.0.0`, Runtime contracts and node kinds are unchanged.
Task Plan keeps its required text `outcome` field and gains optional
`outcome_contract_ref` and `outcome_contract_digest` fields. Mirai 2.4 packages
without structured outcome contracts remain valid.

## Episode Terminology

Dynamic Episode Layer describes domain observations and learning-oriented
feedback. Runtime Episodes record deterministic program/runtime execution.
An Outcome Assessment digest may be bound into either as evidence, but the two
episode types remain distinct.

## Transfer Intake Rule

External or private handoffs may be marked
`safe_to_ingest_for_read_only_review`; they must not claim
`safe_to_auto_accept`. Review evidence must bind to an exact Mirai release
commit. Cold-start, semantic-ready and delivery latency are reported separately.
