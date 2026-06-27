# Semantic Intent And Goal Vector Control

Status: article foundation

## Working Title

Semantic Intent and Goal-Vector Control for Reducing Drift in AI-Assisted
Workflows

## Core Question

Can a graph-governed workflow reduce AI drift by controlling two failure points:

1. wrong start before execution;
2. false completion or goal drift after execution.

## Proposed Contribution

The article introduces a two-sided control model:

```text
Semantic Intent Resolution
-> governed work start
-> Goal Vector Quality Control
-> reverse audit before completion
```

The model treats intent confidence, goal vectors, evidence and reverse audit as
quality-control artifacts. They do not authorize action, release or canonical
graph update.

## Hypotheses

- H1. Explicit intent, scale, owner and missing-context decisions reduce
  wrong-start errors compared with direct execution from a free-form request.
- H2. Explicit batch-to-final-outcome vector links reduce unproductive work that
  looks useful but does not advance the goal.
- H3. Reverse audit reduces false completion claims by checking required
  qualities from final outcome back to evidence and actual work.

## Public Artifacts

- `standard/semantic-intent-resolution.md`
- `schemas/semantic-intent-resolution.schema.json`
- `examples/semantic-intent-resolution-minimal/`
- `standard/goal-vector-quality-control.md`
- `schemas/goal-vector-quality-control.schema.json`
- `examples/goal-vector-quality-control-minimal/`
- `releases/1.0.0-rc.5.md`
- `releases/1.0.0-rc.6.md`

## Experiment Design

Compare baseline AI-assisted work with Mirai Graph-controlled work on matched
tasks.

Baseline:

```text
free-form request -> direct execution -> final answer
```

Graph-controlled condition:

```text
free-form request
-> semantic intent record
-> goal vector
-> batch vector links
-> evidence
-> reverse audit
-> final answer or correction route
```

## Candidate Metrics

- wrong-start count;
- missing-context-at-start count;
- work-scale mismatch count;
- batch-without-goal-vector count;
- false-completion claim count;
- missing-evidence count;
- reverse-audit finding count;
- correction-route coverage;
- reviewer correction count.

## Required Evidence Before Publication

- At least one sanitized baseline-vs-graph-controlled pilot.
- Replayable task package with public-safe inputs and outputs.
- Limitations table covering task selection, reviewer bias, model variance and
  synthetic fixture limits.
- Negative examples showing failures caught by the validator or review protocol.

## Limitations

Current public artifacts validate model shape and fail-closed fixtures. They do
not prove real-world drift reduction, generalize across organizations or replace
human review.
