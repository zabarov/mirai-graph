# Implementation Control Cycles

Status: initial public standard note

## Purpose

Implementation-control cycles define repeatable, governed work scenarios inside
GrowGraph. They make project movement explicit without treating generated
context, feedback, evidence or runtime output as automatic permission to change
canonical state.

## Core Principle

```text
cycle = repeatable governed scenario
gate = readiness, safety or approval check
evidence = trace supporting a claim
proposal = reviewable request for canonical change
controlled update = approved canonical change
```

Cycles must define inputs, outputs, stages, gates, validators, recovery
behavior, repeat condition and promotion path.

`stages` describe the human-readable projection of work. Executable process
movement must use state-machine fields such as `executable_states`,
`state_mapping` and `state_machine_id`. Narrative stages are not enough to
authorize state transitions.

Cycle transitions define when one cycle may hand off to another. A cycle does
not silently start the next cycle. It produces a transition decision with
required outputs, required gates and a handoff artifact.

## Standard Cycles

### `human_projection_feedback`

Purpose: create a human-readable projection from a graph baseline, review it
for semantic gaps and convert accepted findings into explicit graph proposals.

Typical stages:

```text
extract_baseline_context
-> generate_projection
-> semantic_review
-> classify_findings
-> create_sync_proposal
-> approval_gate
-> regenerate_projection
```

Promotion path: accepted review findings become sync proposals. The projection
itself does not become canonical truth.

### `implementation_planning`

Purpose: convert a reviewed baseline, feature scope or project goal into a
bounded work plan with owners, gates, allowed scope and evidence requirements.

Promotion path: accepted plans create launch-ready batches, not executed work.

### `bounded_work_batch`

Purpose: execute only the scope approved by a launch gate.

Promotion path: work output becomes evidence and possibly a sync proposal. It
does not directly update canonical graph state.

### `review_and_evidence`

Purpose: verify implementation evidence, semantic acceptance, drift and
proposal readiness before approval.

Promotion path: accepted evidence may support approval, but evidence is not
approval by itself.

Significant work should also include technology quality feedback: a separate
check that the declared method, process or technology was actually followed.
Passing tests and complete evidence are not enough when the workflow itself
drifted from the accepted technology.

### `release_or_publish`

Purpose: decide whether an artifact, package or public output is ready for
release or publication.

Promotion path: release readiness requires explicit gates and public-safety
review when the artifact becomes public.

### `runtime_feedback`

Purpose: capture operational, user or runtime feedback and convert it into
reviewable improvement items or graph proposals.

Promotion path: feedback becomes a proposal or Kaizen item. It must not mutate
canonical behavior automatically.

### `kaizen_improvement`

Purpose: evaluate completed cycles and convert lessons, regressions and
improvement opportunities into controlled artifact, graph, process, validator,
tooling or backlog changes.

Typical stages:

```text
evaluate_result
-> classify_improvement
-> check_impact_and_risk
-> decide_accept_or_defer
-> validate_improvement_path
-> choose_next_transition
```

Kaizen is a meta-cycle. It is not a replacement for `runtime_feedback`:

- `runtime_feedback` captures operational, user or runtime evidence;
- `kaizen_improvement` reviews the quality of completed work and the quality
  of the process that produced it.

Kaizen blocks the next transition only for safety, quality, DNA alignment or
critical drift findings. Other improvements are accepted locally or deferred to
follow-up proposals.

## Cycle Transitions

The public cycle pattern is:

```text
cycle completed
-> transition decision
-> kaizen review
-> classified improvement
-> blocking/non-blocking decision
-> next governed cycle
```

Each transition must define:

- source cycle;
- target cycle;
- trigger;
- required outputs;
- required gates;
- handoff artifact;
- owner;
- failure behavior;
- recovery behavior.

Default rule: if a transition gate does not pass, the next cycle is not
available. The source cycle must repeat, record a blocker or produce a handoff
that explains the missing condition.

Kaizen default rule: every major cycle records whether improvement was needed.
If improvement is needed, it is classified before the next transition is
chosen.

Recommended Kaizen finding taxonomy:

- `artifact_improvement`;
- `graph_spec_improvement`;
- `process_improvement`;
- `validator_improvement`;
- `tooling_improvement`;
- `dna_alignment_issue`;
- `quality_regression`;
- `safety_regression`;
- `critical_drift`;
- `user_value_gap`.

## Required Boundaries

- `ready_to_execute` is not `executed`.
- `ready_to_code` is not `implemented`.
- Generated projection is not source of truth.
- Evidence is not approval.
- Passing tests are not acceptance.
- Technology quality feedback supports acceptance; it is not acceptance by
  itself.
- Feedback is not canonical update.
- Proposal is not controlled update.
- Runtime decision is not executed action.

## Schema

Machine-readable cycle results can be validated with:

```text
schemas/implementation-control-cycle.schema.json
```

The schema validates public shape and traceability. It does not prove semantic
truth, operational effectiveness or real-world safety.
