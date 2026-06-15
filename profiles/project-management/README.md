# Project Management Profile

Status: 1.0 release-candidate profile

## Purpose

The project-management profile adapts Mirai Graph to small project and workflow
management.

It helps connect:

- goals;
- tasks;
- decisions;
- risks;
- milestones;
- stakeholders;
- evidence;
- governance gates.

## Object Kinds

Initial allowed object kinds:

- `system`;
- `goal`;
- `task`;
- `decision`;
- `risk`;
- `milestone`;
- `stakeholder`;
- `evidence`;
- `governance_gate`.

## Relation Types

Initial allowed relation types:

- `depends_on`;
- `blocks`;
- `supports`;
- `evidences`;
- `belongs_to`;
- `governs`;
- `related_to`.

## Governance Gates

Initial gates:

- `human_review_before_canonical_write`;
- `owner_approval_before_action`.

Domain-specific projects may add gates such as:

- `owner_approval_before_schedule_publish`;
- `privacy_review_before_public_release`;
- `budget_owner_approval_before_commitment`.

## Readiness Guidance

Use:

- `draft` for early tasks, decisions and risks;
- `review_ready` when the object is ready for owner review;
- `accepted` only after owner or reviewer acceptance;
- `blocked` when missing evidence or approval prevents progress;
- `deprecated` when the item is superseded but should remain traceable.

## Adoption Path

Recommended path:

1. Start with a graph seed.
2. Generate or manually draft a graph embryo.
3. Accept only reviewed objects and relations into canonical graph state.
4. Add governance gates for decisions or actions.
5. Generate context packs for concrete tasks.
6. Record readiness score and gaps.

## Pilot Evidence

Pilot 001 uses this profile:

`pilots/independent-implementation-001-conference-planning/`

Pilot finding:

The profile is sufficient for a small Level 1 package, but needs richer
modeling for milestones, owners, task status vs readiness and action records.

## Next Extension Candidates

Larger managed projects need a richer project-control model than the initial
Level 1 profile. Public-safe harvest work identified the following extension
candidates:

- lifecycle stages;
- implementation clusters;
- workflow batches;
- human projection feedback loops;
- review records;
- release gates;
- graph sync proposals;
- candidate closure decisions;
- continuous-improvement items.

These candidates are not yet part of `profile.json`. They should be introduced
through a future profile extension or a separate implementation-control profile
after synthetic examples and validation rules are added.

See:

- `docs/transfer/project-management-standard-harvest-2026-06-02.md`
- `examples/managed-project-control-loop/README.md`
