# Measure-Convert-Optimize Protocol

Status: initial public protocol

## Purpose

Mirai Graph adoption must be measured, not assumed to be better.

This protocol defines how to compare a current workflow with a Mirai Graph-assisted
workflow.

## Cycle

```text
freeze benchmark
-> measure current mode
-> convert selected scope to Mirai Graph
-> measure graph mode
-> compare
-> optimize
-> validate
-> scale
```

## 1. Freeze Benchmark

Before converting a target scope, freeze:

- benchmark suite;
- dataset;
- task ids;
- expected outputs;
- acceptance criteria;
- review policy;
- metrics.

Do not change the suite after current-mode baseline if direct comparison is
required.

## 2. Measure Current Mode

Record:

- materials read;
- context size;
- time to relevant context;
- time to done;
- wrong assumptions;
- missed dependencies;
- user corrections;
- rework cycles;
- evidence references used;
- final result;
- reviewer notes.

## 3. Convert Selected Scope

Convert only a small scope first:

- goals;
- objects;
- relations;
- evidence;
- readiness;
- governance gates;
- context-pack boundary.

Do not convert a whole organization before validating a local graph.

## 4. Measure Graph Mode

Record:

- profile;
- graph depth;
- objects considered;
- relations traversed;
- generated context size;
- context pack contents;
- stale findings;
- warnings;
- final result;
- reviewer notes.

## 5. Compare

Compare only when:

- suite version matches;
- dataset version matches;
- task list matches;
- acceptance criteria match;
- review policy matches.

If these changed, start a new experiment series.

## 6. Optimize

Use comparison results:

- low precision -> improve object selection;
- low recall -> improve relations or extraction;
- negative context reduction -> narrow context profile;
- missed dependencies -> improve impact traversal;
- high review overhead -> simplify graph granularity;
- weak evidence coverage -> improve evidence modeling.

## 7. Validate

Use a separate evaluation set where possible.

Do not tune only on the same tasks used for final claims.

## Minimum Metrics

- `time_to_context`;
- `context_units`;
- `context_precision`;
- `missed_dependencies`;
- `wrong_assumptions`;
- `rework_cycles`;
- `evidence_coverage`;
- `time_to_done`;
- `manual_review_overhead`.

## Claim Rule

Use results only for claims supported by the protocol.

A local pilot can support local usefulness. It does not prove universal
validity.
