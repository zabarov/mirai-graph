# Implementation Control Profile

Status: 1.0 release-candidate profile

## Purpose

The implementation-control profile adapts Mirai Graph to governed implementation
workflows where generated context, human review, evidence, proposals and gates
must be separated from canonical updates and executed actions.

It is the profile to use when the hard question is not "what are the project
tasks?" but "is this work allowed to move from knowledge or planning into
bounded execution, implementation state, release readiness or canonical graph
change?"

It is useful when a project needs to coordinate:

- implementation baselines;
- generated human projections;
- semantic reviews;
- workflow batches;
- implementation cycles;
- technology contracts and technology quality feedback;
- graph DNA alignment;
- source boundary contracts;
- work state machines;
- recovery records;
- risk controls;
- multi-agent coordination contracts;
- evidence packs;
- graph sync proposals;
- launch gates;
- approval gates;
- controlled canonical updates;
- drift checks;
- continuous-improvement items.

## Core Pattern

```text
baseline
-> projection view
-> semantic review
-> launch gate
-> workflow batch
-> evidence pack
-> technology quality feedback
-> sync proposal
-> approval gate
-> controlled update
-> drift check
-> improvement item
```

`ready_to_execute` and `ready_to_code` are readiness states. They are not the
same as `executed`, `implemented`, `evidence_ready` or `release_ready`.

## Object Kinds

Initial allowed object kinds:

- `implementation_baseline`;
- `projection_view`;
- `semantic_review`;
- `workflow_batch`;
- `implementation_cycle`;
- `technology_contract`;
- `technology_quality_feedback`;
- `quality_finding`;
- `graph_dna`;
- `component_dna`;
- `dna_alignment`;
- `source_boundary_contract`;
- `source_boundary`;
- `work_state_machine`;
- `work_state`;
- `recovery_record`;
- `risk_control`;
- `agent_reservation`;
- `coordination_contract`;
- `evidence_pack`;
- `sync_proposal`;
- `launch_gate`;
- `approval_gate`;
- `controlled_update`;
- `implementation_state`;
- `drift_check`;
- `validator`;
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
- `launches_batch`;
- `requires_launch_record`;
- `checks_transition`;
- `checks_conformance_to`;
- `classifies`;
- `routes_to`;
- `requires_technology_feedback`;
- `requires_kaizen_closure`;
- `approves_update`;
- `updates_baseline`;
- `checks_drift`;
- `validates_cycle`;
- `progresses_to`;
- `promotes_feedback`;
- `aligns_with`;
- `owns_scope`;
- `excludes_scope`;
- `defines_boundary`;
- `transitions_to`;
- `resumes_from`;
- `controls_risk`;
- `reserves_scope`;
- `coordinates_with`;
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
- `launch_gate_before_work_batch`;
- `approval_before_canonical_update`;
- `drift_check_before_state_promotion`;
- `technology_quality_feedback_before_acceptance`;
- `public_safety_before_public_transfer`;
- `no_generated_context_as_authorization`;
- `no_feedback_as_automatic_update`.

## Relationship To Project Management

Use `project-management` for ordinary project goals, tasks, risks, milestones
and stakeholder coordination.

Use `implementation-control` when the critical question is whether a proposed
implementation or graph update is sufficiently evidenced, reviewed and approved
to affect canonical state.

In short: `project-management` coordinates work; `implementation-control`
governs movement from plans and generated context into bounded action,
evidence, approved updates and process learning.

## Public Example

Executable example:

```text
examples/implementation-control-minimal/
```
