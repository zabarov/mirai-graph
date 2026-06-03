# Mirai Graph Baseline Comparison Protocol

Status: alpha protocol

## Purpose

This protocol describes how to compare a document/chat/task-tracker workflow
against a Mirai Graph-assisted workflow without overclaiming.

## Comparison Setup

Use the same task, source materials and reviewer criteria for both modes.

Mode A:

```text
baseline documents/chats/task notes
```

Mode B:

```text
Mirai Graph package -> context pack -> governed process control
```

## Required Inputs

- task statement;
- source materials;
- expected dependency list;
- expected evidence list;
- reviewer acceptance criteria;
- timebox;
- allowed tools;
- recording template.

## Measurements

Record:

- context size;
- selected context precision;
- missed dependencies;
- unsupported assumptions;
- evidence coverage;
- false progress claims;
- rework cycles;
- time to relevant context;
- time to validated completion;
- review overhead.

## Result Template

```text
task_id:
baseline_context_units:
mirai_graph_context_units:
missed_dependencies_baseline:
missed_dependencies_mirai_graph:
unsupported_assumptions_baseline:
unsupported_assumptions_mirai_graph:
evidence_coverage_baseline:
evidence_coverage_mirai_graph:
reviewer_notes:
limitations:
verdict:
```

## Acceptance Rule

A Mirai Graph result is stronger only when it improves at least one target metric
without making critical safety, evidence or semantic-completeness metrics worse.

## Boundaries

- One task does not prove broad effectiveness.
- A smaller context is not better if important dependencies are omitted.
- Passing validators do not prove semantic completeness.
- Human review remains required for scientific claims.
