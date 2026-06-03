# Mirai Graph Evidence Package v0.1

Status: alpha research package

Superseded by: [Evidence Package v0.2](evidence-package-v0.2.md) as the current
public evidence entrypoint. This document remains a historical v0.1 snapshot.

## Purpose

This package defines the current public evidence base for Mirai Graph v0.1 alpha.
It is designed for research review, publication preparation and reproducibility
checks.

It does not claim peer-reviewed proof of effectiveness.

## Research Questions

1. Can graph-structured project state reduce task-context size while preserving
   relevant dependencies?
2. Can evidence-linked relations reduce unsupported assumptions in
   AI-assisted work?
3. Can launch records and process transitions reduce false progress claims?
4. Can recovery, source-boundary and Kaizen records improve continuation across
   long-running workflows?

## Evidence Inventory

| Evidence type | Public artifact | Current role |
|---|---|---|
| Synthetic benchmark | `benchmarks/synthetic-context-reduction-v0/` | Reproducible context-reduction demonstration |
| Context-pack validation | `benchmarks/synthetic-context-reduction-v0/results/context-pack.json` | Expected generated context example |
| Baseline comparison result | `benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json` | Synthetic baseline-vs-Mirai Graph metric comparison |
| Routing-control fixture | `examples/federation-routing-smoke/` | Explainable routing and regression shape |
| Process-transition fixture | `examples/process-transition-minimal/` | False-transition guard demonstration |
| Implementation-control cycle | `examples/implementation-control-cycles/` | Cycle and Kaizen transition model |
| Public pilot 001 | `pilots/independent-implementation-001-conference-planning/` | Independent implementation package |
| Public pilot 002 | `pilots/independent-implementation-002-software-specification/` | Software-specification package |
| Public pilot 003 | `pilots/independent-implementation-003-ai-employee-workflow/` | AI employee workflow package |
| Public pilot 004 | `pilots/independent-implementation-004-research-program/` | Research-program governance package |

## Metrics

Current metrics:

- context size reduction;
- context-pack validity;
- profile conformance;
- false-transition rejection;
- evidence coverage;
- readiness score.

Planned metrics:

- missed dependency count;
- unsupported assumption count;
- rework cycles;
- time to relevant context;
- time to validated completion;
- manual review overhead.

## Reproducibility Commands

```bash
npm run benchmark:synthetic
npm run validate:context-packs
npm run validate:profile-results
npm run validate:process-transition
npm run validate:process-transition-report
npm run test:process-transition-negative
npm run validate:baseline-comparison
npm run playground:demo
npm run playground:report
```

## Evidence Boundaries

- Synthetic fixtures demonstrate method shape and executable validation.
- Public pilots demonstrate applicability, not universal effectiveness.
- Passing validators prove conformance to current alpha checks only.
- Readiness scores are navigation signals, not approval.
- Generated context is not canonical state.
- Evidence and proposals do not authorize canonical updates.

## Current Maturity Verdict

Mirai Graph is ready for:

- public alpha adoption;
- internal and public-safe pilots;
- developer integration experiments;
- research protocol refinement;
- preprint preparation.

Mirai Graph is not yet ready for:

- v1.0 stability claims;
- production autonomous execution claims;
- broad scientific effectiveness claims;
- country-scale governance claims without further evidence.
