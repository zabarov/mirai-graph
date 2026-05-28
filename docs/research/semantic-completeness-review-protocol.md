# Semantic Completeness Review Protocol

Status: initial public protocol

## Purpose

Context reduction is useful only if the reduced context preserves the meaning
needed for the task.

This protocol reviews whether a generated context pack is semantically complete
enough for its declared task.

## Research Question

Does the generated context pack preserve the objects, relations, evidence,
risks and governance constraints needed to perform the task?

## Review Inputs

- task definition;
- canonical graph package;
- generated context pack;
- source corpus or source summary;
- evidence references;
- expected output or reviewer rubric.

## Review Rubric

Score each dimension from `0` to `2`:

- `0`: missing or misleading;
- `1`: partially present;
- `2`: sufficient for the task.

Dimensions:

1. Task relevance.
2. Required object coverage.
3. Required relation coverage.
4. Evidence preservation.
5. Risk and blocker visibility.
6. Governance gate visibility.
7. Omission transparency.
8. No private or unsafe leakage.

## Verdicts

- `pass`: sufficient for the task.
- `pass_with_notes`: usable, but limitations must be recorded.
- `needs_more_context`: important context is missing.
- `semantic_regression`: context reduction changed or weakened meaning.
- `unsafe_context`: context leaks private material or hides safety constraints.

## Output Artifact

Recommended output:

```text
benchmarks/<benchmark-id>/reviews/semantic-completeness-review.json
```

## Claim Rule

Passing this review supports a limited claim:

```text
The generated context pack preserved task-relevant meaning under this review protocol.
```

It does not prove external validity or universal semantic completeness.
