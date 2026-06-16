# Dynamic Layer For AI-Assisted Code Generation

Status: proposal/experimental standard section

## Purpose

The Dynamic Episode Layer can be applied to AI-assisted code generation to keep
implementation work inside the intended specification, package boundary and
technology chain.

The target pattern is:

```text
feature/package request
-> package DNA and feature graph
-> dependency activation
-> implementation technology chain
-> bounded code generation
-> test/evidence collection
-> dynamic episode trace
-> technology quality feedback
-> developer feedback classification
-> Kaizen / graph update proposal
-> replay or regression check
```

## Code Drift Classes

The layer should make these drift types visible:

- `scope_drift`: files or components outside the allowed scope were changed.
- `package_boundary_violation`: a package owned another package's concern.
- `wrong_dependency_activation`: required dependencies were not activated.
- `unsupported_assumption`: the agent invented missing behavior or API shape.
- `wrong_workflow_selected`: the wrong implementation technology was followed.
- `technology_step_skipped`: a required work step was omitted.
- `approval_gate_bypass`: readiness, tests or evidence were treated as
  authorization.
- `evidence_gap`: result claims are not backed by required evidence.
- `feedback_loss`: developer feedback was not routed to reusable improvement.

## Required Episode Outputs

For significant code-generation episodes, store:

```text
episode-trace.json
episode-trace.md
technology-quality-feedback.json
developer-feedback-classification.md
kaizen-proposal.md
metrics.json
```

The exact storage path is project-specific. For internal projects, use
`source/output/dynamic-episodes/<episode-id>/` or another project-local
generated/evidence path.

## Acceptance Boundary

Code can be generated, tests can pass and evidence can be collected, but the
episode is not accepted until the relevant process-control and technology
quality gates pass.

The trace may propose:

- work fix;
- test gap;
- spec gap;
- graph update proposal;
- process improvement;
- blocker;
- replay/regression scenario.

It must not update the canonical specification, graph or source code by itself.

## Research Use

For research, episode traces can support comparison between:

- prompt/spec-only baseline;
- graph/context package without dynamic trace;
- graph + technology chain + dynamic episode trace.

Claims must remain bounded. Synthetic or internal pilot evidence is not broad
scientific proof until it is reproduced, reviewed and published with clear
limitations.
