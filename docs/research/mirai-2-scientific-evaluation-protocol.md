# Mirai 2 Scientific Evaluation Protocol

Status: preregistration candidate; no effectiveness result is claimed

## Research Question

Does a governed executable Mirai Program improve technology adherence and
reduce outcome variance compared with ordinary instructions and Mirai Graph
1.4, especially when the underlying model is weaker?

## Design

Use a factorial design:

```text
strong model vs weaker model
x
plain instructions vs Mirai Graph 1.4 vs Mirai 2.0
```

Run the design separately in Federation, Larena code generation and AI
employee workflow domains. The unit of analysis is an independent task, not a
retry of the same task in one chat. Each condition receives the same source
revision, task contract, tool boundary and time budget.

## Endpoints

Primary endpoint:

- technology adherence: completed required steps divided by applicable
  required steps, with blocking violations scoring zero for the affected gate.

Secondary endpoints:

- task correctness;
- skipped mandatory steps;
- unauthorized effects;
- false completion claims;
- correction loops;
- token use and cost;
- elapsed time;
- audit completeness;
- replay and recovery success.

Operational definitions are frozen in the
[metric dictionary](mirai-2-metric-dictionary.md). The machine-readable study
plan and current power-analysis readiness live in
`benchmarks/mirai-2-scientific-evaluation/`.

## Randomization And Blinding

- randomize task-condition order within each model stratum;
- isolate workspaces and conversations between runs;
- conceal the condition label from outcome reviewers;
- keep the scoring rubric frozen before unsealing results;
- retain failed, blocked and interrupted runs in the analysis.

The outcome-review boundary is specified in the
[blinded review guide](mirai-2-blinded-review-guide.md).

## Sample Size

Use beta pilot variance for a power analysis with `alpha=0.05` and power `0.8`.
The preregistered range is 10 to 40 independent tasks per domain, with three
repetitions per task-condition cell. Do not choose the final sample after
looking at significance.

## Existing Evidence Boundary

The Larena blind benchmark is a useful historical baseline and includes a
bounded negative result: its context-oriented Mirai Graph arm was not promoted
for any tested task class. It did not evaluate Mirai 2 executable programs and
therefore cannot be relabeled as Mirai 2 evidence.

Federation conformance and AI employee readiness reports are historical
engineering evidence. They do not substitute for randomized model-condition
runs.

## Hypotheses, Not Promises

Targets such as 40 percent less context or a 15 percentage-point pass-rate
increase remain hypotheses until the preregistered experiment produces them.
Stable release documentation must report observed estimates, uncertainty and
limitations rather than these targets.
