# Mirai Graph Scientific Evidence Package

Status: alpha evidence framing

## Purpose

This document defines how public Mirai Graph evidence should be read. It connects
synthetic benchmarks, public pilots, reproducibility materials and publication
notes without overclaiming scientific proof.

## Current Research Hypotheses

Mirai Graph is currently evaluated around these hypotheses:

- Graph-structured project state can reduce task-context size while preserving
  relevant dependencies.
- Evidence-linked relations can reduce missed dependencies and unsupported
  assumptions in AI-assisted work.
- Launch records, process transitions and governance gates can reduce false
  progress claims such as treating readiness as execution.
- Recovery, source-boundary and Kaizen records can improve continuation across
  long-running human-AI workflows.

These are hypotheses and engineering claims under test, not settled scientific
facts.

## Evidence Levels

### Synthetic Evidence

Synthetic evidence uses public-safe examples and benchmarks.

Current materials:

- `benchmarks/synthetic-context-reduction-v0/`
- `benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json`
- `examples/federation-routing-smoke/`
- `examples/process-transition-minimal/`
- `examples/implementation-control-cycles/`

Use synthetic evidence to inspect method shape, validation behavior and
reproducibility. Do not treat it as broad external validity.

### Public Pilot Evidence

Pilot evidence uses public-safe implementation packages and reports.

Current materials:

- `pilots/independent-implementation-001-conference-planning/`
- `pilots/independent-implementation-002-software-specification/`
- `pilots/independent-implementation-003-ai-employee-workflow/`
- `pilots/independent-implementation-004-research-program/`

Use pilot evidence to inspect whether the model can be applied outside the
minimal examples. Pilot evidence still needs replication and independent
review.

### Scientific Evidence

Scientific evidence requires explicit protocols, metrics, limitations and
comparison baselines.

Current supporting materials:

- `docs/research/evidence-package-v0.2.md`
- `docs/research/evidence-package-v0.1.md`
- `docs/research/baseline-comparison-protocol.md`
- `docs/research/limitations-and-threats.md`
- `docs/research/practice-science-program.md`
- `docs/research/independent-implementation-pilot-plan.md`
- `docs/research/semantic-completeness-review-protocol.md`
- `publications/README.md`
- `publications/preprint-note.md`
- `publications/preprint-outline.md`

Use `docs/research/evidence-package-v0.2.md` as the current public evidence
entrypoint. The v0.1 package remains a historical alpha evidence snapshot.

## Metrics Under Development

Recommended metrics:

- context size reduction;
- context precision;
- missed dependency count;
- unsupported assumption count;
- evidence coverage;
- rework cycles;
- time to relevant context;
- time to validated completion;
- review overhead;
- false-transition rejection rate.

## Reproducibility Path

Run:

```bash
npm run benchmark:synthetic
npm run validate:context-packs
npm run validate:profile-results
npm run validate:process-transition
npm run validate:process-transition-report
npm run test:process-transition-negative
npm run validate:baseline-comparison
npm run validate:pilots
npm run validate:templates
npm run validate:cli-unified
```

Then inspect:

- benchmark input package;
- generated or expected context pack;
- validator output;
- profile conformance results;
- limitations recorded in each result.

## Claim Boundaries

Mirai Graph public alpha may claim:

- a public standard draft exists;
- schemas, validators and examples are runnable;
- synthetic and pilot evidence are separated;
- baseline comparisons are public-safe and bounded by explicit limitations;
- governance controls can be represented and tested in public-safe fixtures.

Mirai Graph public alpha must not claim:

- peer-reviewed proof of effectiveness;
- production safety for autonomous execution;
- universal superiority over document-based workflows;
- automatic correctness of generated context;
- canonical update authorization from evidence, feedback or proposals.

## Next Evidence Work

- Add more independent public pilots.
- Replicate baseline-vs-graph comparison reports across different domains.
- Publish limitation tables per pilot.
- Prepare publication-ready reproducibility bundles.
- Record reviewer objections and response notes when publications exist.
