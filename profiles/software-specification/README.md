# Software Specification Profile

Status: 1.0 release-candidate profile

## Purpose

The software-specification profile adapts Mirai Graph to software packages,
features, requirements, constraints, risks, implementation tasks and evidence.

It helps connect:

- package scope;
- requirements;
- features;
- components;
- constraints;
- risks;
- implementation tasks;
- decisions;
- evidence.

## Object Kinds

Initial allowed object kinds:

- `package`;
- `feature`;
- `requirement`;
- `constraint`;
- `risk`;
- `component`;
- `task`;
- `decision`;
- `evidence`.

## Relation Types

Initial allowed relation types:

- `implements`;
- `depends_on`;
- `blocks`;
- `evidences`;
- `generates`;
- `related_to`;
- `supersedes`.

## Governance Gates

Initial gates:

- `human_review_before_canonical_write`;
- `public_safety_before_release`.

Domain-specific projects may add gates such as:

- `requirement_traceability_before_implementation`;
- `security_review_before_release`;
- `acceptance_criteria_before_development`;
- `test_evidence_before_acceptance`.

## Traceability Guidance

For implementation work, prefer explicit task traceability:

```text
task -> implements -> feature
task -> depends_on -> requirement
feature -> implements -> requirement
component -> implements -> feature
constraint -> blocks -> risk
decision -> blocks -> risk
```

This makes generated context packs less likely to omit the underlying
requirement when the task title only matches an implementation detail.

## Readiness Guidance

Use:

- `draft` for early requirements, components, decisions and task plans;
- `review_ready` when a requirement, feature, task or risk is ready for owner
  review;
- `accepted` only after review evidence exists;
- `blocked` when missing requirement, security, acceptance or test evidence
  prevents progress;
- `deprecated` when a requirement, feature or decision is superseded.

## Recommended Minimal Package

A useful Level 1 software-specification package should include:

- at least one `package`;
- at least one `requirement`;
- at least one `feature`;
- at least one implementation `task`;
- at least one `evidence` object;
- direct traceability from task to feature and requirement;
- constraints and risks when safety, privacy, security or reliability matters;
- gate results for public safety or requirement traceability when the package
  is used as evidence.

## Current Limitations

The profile does not yet define first-class object kinds for:

- API endpoints;
- acceptance criteria;
- test cases;
- verification results;
- non-functional requirement categories;
- owners or reviewers.

Use `requirement`, `constraint`, `task`, `decision` and `evidence` until these
extensions are standardized.

## Adoption Path

Recommended path:

1. Start with a graph seed.
2. Draft package, requirement, feature, component, task, risk and evidence
   objects.
3. Add direct task-to-requirement traceability before using the graph for
   implementation context.
4. Add constraints and risks for security, reliability or privacy concerns.
5. Run package validation and readiness scoring.
6. Generate a context pack for one implementation task.
7. Review omissions before using the context pack for work.

## Pilot Evidence

Pilot 002 uses this profile:

`pilots/independent-implementation-002-software-specification/`

Pilot finding:

The profile is sufficient for a small Level 1 package, but needs richer
modeling for acceptance criteria, API contracts, non-functional requirements,
test evidence and conformance fixtures.
