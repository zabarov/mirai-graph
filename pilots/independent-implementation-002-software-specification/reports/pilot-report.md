# Pilot Report: Independent Implementation 002

Date: 2026-05-28

Status: `pass_with_notes`

## Purpose

Test whether a valid Mirai Graph Level 1 package can be created for a small
software specification workflow using only the public repository materials.

## Domain

Synthetic team notification API workflow.

No private company, customer, employee, repository issue or production material
was used.

## Research Question

Can a developer create a valid Level 1 Mirai Graph package for a small software
specification using only public Mirai Graph docs, schemas and examples?

## Result

Verdict: `pass_with_notes`

The pilot produced:

- valid graph seed;
- valid Mirai Graph package;
- valid object and relation files;
- public-safety gate result;
- requirement-traceability gate result;
- generated graph embryo preview;
- generated context pack;
- readiness score.

## Evidence

Validation artifacts:

- `results/seed-validation.json`
- `results/package-validation.json`
- `results/graph-embryo.json`
- `results/context-pack.json`
- `results/readiness-score.json`
- `reviews/semantic-completeness-review.json`

Package summary:

- objects: `11`;
- relations: `10`;
- evidence objects: `1`;
- accepted objects: `2`;
- gate results: `2`;
- target mode: `pilot`;
- readiness score: `69`;
- readiness band: `G3_pilot_ready`.
- semantic completeness verdict: `pass_with_notes`;
- semantic completeness score: `15/16`.

## What Worked

- The software-specification profile was sufficient for a small package,
  requirement, feature, component, risk, decision and implementation-task map.
- The package validator caught structural risks while the graph was drafted.
- The context-pack generator produced a task-bounded package for
  `task.implement_retry_policy`.
- A direct task-to-requirement relation improved traceability and made the
  generated task context more useful.
- Semantic review made safety-context omissions explicit.
- Context-pack selection explanations now show relevance scores and inclusion
  reasons for selected objects and relations.
- Readiness scoring correctly capped the result because evidence is synthetic
  and benchmark evidence is missing for this pilot.

## Gaps Found

### Standard Gap

The software-specification profile is still thin. It validates the basic
object families but does not yet explain:

- acceptance criteria modeling;
- API contract or endpoint modeling;
- non-functional requirements;
- task-to-requirement traceability expectations;
- security constraint coverage;
- test-case and verification-result objects.

### Tooling Gap

The context-pack generator selected a useful task context after explicit
traceability was added. It still does not:

- explain why each object or relation was selected;
- score relevance;
- detect that a task lacks direct requirement traceability;
- identify omitted safety constraints that may still be important.

### Research Gap

The pilot proves package creation and validation for a synthetic software
specification. It does not measure:

- implementation speed;
- defect reduction;
- reviewer comprehension;
- downstream AI answer quality;
- real software delivery outcomes.

### Documentation Gap

The software-specification profile needs a public profile guide with worked
examples for requirements, features, components, tasks, risks, constraints,
acceptance criteria and verification artifacts.

## Interpretation

This pilot supports a limited claim:

```text
A valid Mirai Graph Level 1 package can be created from public repository
materials for a small synthetic software specification.
```

It does not support claims about:

- real-world software productivity;
- semantic completeness;
- external validity;
- runtime safety;
- universal applicability.

## Recommended Next Actions

1. Add software-specification profile documentation.
2. Add profile conformance fixtures for required traceability patterns.
3. Add context-pack selection explanations and relevance scores.
4. Add acceptance-criteria and verification-result modeling examples.
5. Add a policy for when safety constraints must be included in task context.
