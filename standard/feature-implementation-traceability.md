# Feature Implementation Traceability

Feature Implementation Traceability is a Mirai Graph pattern for connecting feature intent to implementation, tests, evidence, documentation, and review.

It answers a simple governance question:

```text
For each feature, what proves where it is implemented, how it was tested, what remains incomplete, and which transition decision it supports?
```

## Scope

The traceability layer is useful for software products, AI employees, research systems, organizational processes, and other projects where generated or human plans must be tied to delivered work.

It should track:

- feature or capability reference;
- owning component or package;
- implementation mapping;
- dependency mapping;
- test and validation evidence;
- documentation evidence;
- review status;
- known gaps and blockers;
- supported transition or release decision.

## Required Separation

Mirai Graph keeps these states separate:

- `specified`: the feature is described;
- `mapped`: the feature is connected to expected implementation locations or work items;
- `implemented`: the work has concrete implementation evidence;
- `tested`: validation evidence exists;
- `reviewed`: semantic or human review exists;
- `accepted`: the relevant gate accepted the work;
- `released`: release or publication gate passed.

`specified`, `mapped`, `ready_to_execute`, and `ready_to_code` are not implementation.

## Mapping Rules

Every mapping should declare:

- `feature_ref`;
- `implementation_refs`;
- `test_refs`;
- `evidence_refs`;
- `review_refs`;
- `documentation_refs`;
- `status`;
- `confidence`;
- `known_gaps`.

An implementation mapping without evidence should stay below accepted readiness.

## Governance Use

Traceability supports:

- cockpit instrumentation;
- process-transition validation;
- release readiness review;
- technology quality feedback;
- drift detection;
- Kaizen classification.

It does not create approval. It gives reviewers and validators a reproducible path from intent to work evidence.
