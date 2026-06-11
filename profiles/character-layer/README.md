# Character Layer Profile

Status: alpha profile

## Purpose

The `character_layer` profile adapts Mirai Graph to model-independent AI
character governance.

It treats character as graph state:

- constitution;
- principles;
- virtues;
- boundaries;
- role character profiles;
- reflection protocols;
- fixtures;
- violation patterns;
- correction loops;
- evidence and governance gates.

## Non-Goals

The profile does not:

- train or fine-tune a base model;
- prove alignment or behavior quality;
- authorize tool use, external actions or canonical writes;
- replace action gates, runtime policy or human approval;
- replace the `ai_employee`, `skill_runtime` or `organization_governance`
  profiles;
- publish private operational constitution content.

## Object Kinds

Initial allowed object kinds:

- `character_constitution`;
- `character_principle`;
- `virtue`;
- `boundary`;
- `role_character_profile`;
- `decision_principle`;
- `reflection_protocol`;
- `character_fixture`;
- `violation_pattern`;
- `correction_loop`;
- `character_evidence`;
- `governance_gate`;
- `evidence`.

## Relation Types

Initial allowed relation types:

- `defines_principle`;
- `requires_virtue`;
- `sets_boundary`;
- `specializes_character`;
- `resolves_conflict_with`;
- `checks_with`;
- `tests_character_with`;
- `violates`;
- `corrects_violation`;
- `updates_character`;
- `evidences_character`;
- `governs_role`;
- `governs_employee`;
- `requires_escalation_to`;
- `governs`;
- `related_to`.

## Governance Gates

Initial gates:

- `human_review_before_canonical_write`;
- `approval_before_external_action`;
- `feedback_learning_before_behavior_update`;
- `public_safety_before_release`;
- `scientific_claim_before_publication`.

## Runtime Boundary

The profile models character state and review boundaries. It does not make
generated context an authorization source.

Use this separation:

```text
canonical character graph
-> generated character context
-> runtime reflection
-> proposed answer or action
-> policy or action gate
-> output or execution
-> reviewed result
-> feedback
-> correction proposal
-> owner-approved canonical update
```

## Minimal Useful Package

A Level 1 character-layer package should include:

- one `character_constitution`;
- several `character_principle` objects;
- at least one `virtue`;
- at least one `boundary`;
- one `reflection_protocol`;
- one `role_character_profile`;
- one `character_fixture`;
- one `violation_pattern`;
- one `correction_loop`;
- one `governance_gate`;
- evidence objects or source records for the public boundary.

## Current Limitations

The profile does not yet standardize:

- provider-specific behavior controls;
- runtime policy enforcement engines;
- human trust or calibration measurement;
- cross-model evaluation;
- product UI requirements;
- private operational constitutions.

## Example

Minimal synthetic fixture:

`examples/character-layer-minimal/`
