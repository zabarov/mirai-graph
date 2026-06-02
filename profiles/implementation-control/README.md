# Implementation Control Profile

Status: initial public profile

## Purpose

The implementation-control profile adapts GrowGraph to governed implementation
workflows where generated context, human review, evidence, proposals and gates
must be separated from canonical updates and executed actions.

It is useful when a project needs to coordinate:

- implementation baselines;
- generated human projections;
- semantic reviews;
- workflow batches;
- evidence packs;
- graph sync proposals;
- approval gates;
- controlled canonical updates;
- continuous-improvement items.

## Core Pattern

```text
baseline
-> projection view
-> semantic review
-> workflow batch
-> evidence pack
-> sync proposal
-> approval gate
-> controlled update
-> improvement item
```

## Object Kinds

Initial allowed object kinds:

- `implementation_baseline`;
- `projection_view`;
- `semantic_review`;
- `workflow_batch`;
- `evidence_pack`;
- `sync_proposal`;
- `approval_gate`;
- `controlled_update`;
- `implementation_state`;
- `risk`;
- `blocker`;
- `review`;
- `release_gate`;
- `kaizen_item`;
- `evidence`.

## Relation Types

Initial allowed relation types:

- `derives_projection`;
- `reviews_projection`;
- `produces_evidence`;
- `proposes_update`;
- `requires_gate`;
- `approves_update`;
- `updates_baseline`;
- `blocks`;
- `mitigates`;
- `records_state`;
- `requires_review`;
- `requires_release_gate`;
- `improves_process`;
- `evidences`;
- `related_to`.

## Governance Gates

Initial gates:

- `semantic_review_before_sync_proposal`;
- `evidence_pack_before_approval`;
- `approval_before_canonical_update`;
- `public_safety_before_public_transfer`;
- `no_generated_context_as_authorization`;
- `no_feedback_as_automatic_update`.

## Relationship To Project Management

Use `project-management` for ordinary project goals, tasks, risks, milestones
and stakeholder coordination.

Use `implementation-control` when the critical question is whether a proposed
implementation or graph update is sufficiently evidenced, reviewed and approved
to affect canonical state.

## Public Example

Executable example:

```text
examples/implementation-control-minimal/
```
