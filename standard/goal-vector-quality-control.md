# Goal Vector Quality Control

Status: 1.0 release-candidate extension contract

## Purpose

Goal Vector Quality Control checks whether meaningful work moves toward the
declared final outcome instead of only producing useful-looking activity.

It is an extension contract, not a standalone Mirai Graph profile. It composes
project management, implementation control, technology quality feedback,
dynamic episode evidence and semantic intent resolution.

## Core Pattern

Goal Vector Quality Control combines forward execution and reverse audit.

Forward execution:

```text
start state
-> final outcome
-> current goal
-> stages
-> batches
-> evidence
-> completion claim
```

Reverse audit:

```text
final outcome
-> required qualities
-> checks and evidence
-> actual result
-> workflow decisions
-> drift findings
-> correction route
```

Every meaningful batch should be able to state:

```text
This batch advances <goal/final outcome> by <specific contribution>.
```

If that link is missing, the work may be drift even when it produced files,
tests or reports.

## Boundary

Goal Vector Quality Control is not authorization.

```text
goal vector != approval
reverse audit != release permission
evidence != acceptance
tests != semantic acceptance
correction route != canonical update
```

The contract may produce quality evidence, drift findings, correction routes,
Kaizen items and graph proposals. It must not grant production permission,
approve deployment, mutate source systems or update canonical graph state.

## Required Fields

- `start_state`
- `final_outcome`
- `work_scale`
- `goal_vector`
- `vector_segments`
- `batch_vector_links`
- `required_qualities`
- `quality_evidence`
- `reverse_audit`
- `drift_findings`
- `correction_routes`
- `quality_verdict`
- `completion_claim`
- `canonical_write_allowed`

## Verdicts

- `PASS`
- `PASS_WITH_NOTES`
- `PARTIAL`
- `CORRECTION_REQUIRED`
- `BLOCKED`
- `FAIL`

`PASS` and `PASS_WITH_NOTES` require evidence, reverse audit and no unresolved
blocking drift findings. `PARTIAL` is suitable for in-progress work when the
vector is visible but the final outcome is not yet complete.

## Integration Points

- `project_management`: owns start state, final outcome, goal vector, stages,
  tasks and batch movement.
- `implementation_control`: owns launch/completion guards, work states,
  evidence boundaries and false completion guards.
- `technology_quality_feedback`: owns reverse audit, finding classification,
  semantic acceptance and correction routing.
- `dynamic_episode_layer`: records what happened, which path was selected and
  why alternatives were blocked.
- `semantic_intent_resolution`: captures intended final outcome and missing
  context before execution starts.

## Public Safety

Public examples must be synthetic. Do not publish private project workflow
contents, private runtime traces, customer messages, access details, tokens,
internal handoff payloads or raw logs.

## Conformance

Initial public conformance is synthetic:

- `G0_concept`: extension contract only.
- `G1_synthetic_fixture`: synthetic example and negative fixtures.
- `G2_internal_pilot`: private pilot evidence with public-safe summary.
- `G3_replay_regression`: replay/regression evidence for drift reduction.
- `G4_audited_runtime`: audited operational use with retention and review
  policy.

The public `1.0` release-candidate layer should claim no more than
`G1_synthetic_fixture` until sanitized pilots and replay evidence are available.
