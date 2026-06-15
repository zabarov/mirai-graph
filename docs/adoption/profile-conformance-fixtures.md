# Profile Conformance Fixtures

Status: 1.0 release-candidate public guide

## Purpose

Profile conformance fixtures show how Mirai Graph validates that a package follows
the object kinds and relation types declared by its profile.

They are not scientific proof of real-world usefulness. They are executable
examples for implementers and regression checks for the public standard.

## Positive Fixtures

Positive fixtures are packages expected to pass validation.

| Fixture | Profile | Purpose |
| --- | --- | --- |
| `pilots/independent-implementation-001-conference-planning/` | `project_management` | Small workflow package using goals, tasks, decisions, risks and governance gates. |
| `pilots/independent-implementation-002-software-specification/` | `software_specification` | Small software package using requirements, features, components, tasks, risks, constraints and decisions. |
| `pilots/independent-implementation-003-ai-employee-workflow/` | `ai_employee` | Small governed AI employee workflow package using roles, tools, policies, actions, feedback and learning gates. |
| `pilots/independent-implementation-004-research-program/` | `project_management` | Small research-program governance package using evidence, milestones, publication gates, risks and decisions. |
| `pilots/independent-implementation-005-organization-governance/` | `organization_governance` | Small organization governance package using mission, strategy, decision rights, controls, metrics, feedback and Kaizen. |
| `benchmarks/synthetic-context-reduction-v0/` | `software_specification` | Synthetic benchmark package for context-pack generation and semantic review. |
| `examples/ai-employee-minimal/` | `ai_employee` | Synthetic AI employee package using role, skill, knowledge, tool, policy, action boundary, feedback and learning gate. |
| `examples/skill-runtime-minimal/` | `skill_runtime` | Synthetic governed skill package using Hybrid SOT, runtime policy, fallback, projection view and federation contract boundaries. |
| `examples/minimal-graph/` | `core` | Minimal core package shape. |

Stored positive result artifacts:

- `examples/minimal-graph/results/profile-conformance-result.json`;
- `examples/ai-employee-minimal/results/profile-conformance-result.json`;
- `examples/skill-runtime-minimal/results/profile-conformance-result.json`;
- `benchmarks/synthetic-context-reduction-v0/results/profile-conformance-result.json`;
- `pilots/independent-implementation-001-conference-planning/results/profile-conformance-result.json`;
- `pilots/independent-implementation-002-software-specification/results/profile-conformance-result.json`;
- `pilots/independent-implementation-003-ai-employee-workflow/results/profile-conformance-result.json`;
- `pilots/independent-implementation-004-research-program/results/profile-conformance-result.json`.
- `pilots/independent-implementation-005-organization-governance/results/profile-conformance-result.json`.

## Negative Fixtures

Negative fixtures are packages expected to fail validation.

| Fixture | Expected failure |
| --- | --- |
| `examples/invalid-missing-relation-target/` | Relation target references a missing object. |
| `examples/invalid-relation-id-mismatch/` | Relation id disagrees with source, type and target fields. |
| `examples/invalid-profile-object-kind/` | Object kind is not allowed by the package profile. |
| `examples/invalid-profile-relation-type/` | Relation type is not allowed by the package profile. |

## Commands

Run the full conformance smoke suite:

```bash
npm run release:check
```

Run only public pilot validation:

```bash
npm run validate:pilots
```

Run positive fixture result checks:

```bash
npm run validate:profile-results
```

Run negative fixture checks:

```bash
npm run test:negative
```

## Current Validator Scope

The validator currently checks:

- required package, object, relation and gate-result fields;
- unique object and relation ids;
- relation source and target existence;
- relation id consistency with source, type and target;
- readiness and gate verdict values;
- profile object-kind conformance;
- profile relation-type conformance.

## Current Limits

The fixtures do not yet prove:

- semantic completeness;
- real-world productivity;
- downstream AI task performance;
- runtime safety;
- external validity.

Semantic completeness is reviewed separately through
`docs/research/semantic-completeness-review-protocol.md`.

## Claim Rule

Passing profile conformance supports this limited claim:

```text
The package follows the declared Mirai Graph profile shape checked by the current validator.
```

It does not support claims about correctness, usefulness or completeness of the
modeled domain.
