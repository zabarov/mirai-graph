# GrowGraph Scientific Evidence Package

Status: alpha evidence framing

## Purpose

This document defines how public GrowGraph evidence should be read. It connects
synthetic benchmarks, public pilots, reproducibility materials and publication
notes without overclaiming scientific proof.

## Current Research Hypotheses

GrowGraph is currently evaluated around these hypotheses:

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

Use pilot evidence to inspect whether the model can be applied outside the
minimal examples. Pilot evidence still needs replication and independent
review.

### Scientific Evidence

Scientific evidence requires explicit protocols, metrics, limitations and
comparison baselines.

Current supporting materials:

- `docs/research/practice-science-program.md`
- `docs/research/independent-implementation-pilot-plan.md`
- `docs/research/semantic-completeness-review-protocol.md`
- `publications/README.md`
- `publications/preprint-note.md`

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
npm run test:process-transition-negative
```

Then inspect:

- benchmark input package;
- generated or expected context pack;
- validator output;
- profile conformance results;
- limitations recorded in each result.

## Claim Boundaries

GrowGraph public alpha may claim:

- a public standard draft exists;
- schemas, validators and examples are runnable;
- synthetic and pilot evidence are separated;
- governance controls can be represented and tested in public-safe fixtures.

GrowGraph public alpha must not claim:

- peer-reviewed proof of effectiveness;
- production safety for autonomous execution;
- universal superiority over document-based workflows;
- automatic correctness of generated context;
- canonical update authorization from evidence, feedback or proposals.

## Next Evidence Work

- Add more independent public pilots.
- Add baseline-vs-graph comparison reports.
- Publish limitation tables per pilot.
- Prepare publication-ready reproducibility bundles.
- Record reviewer objections and response notes when publications exist.
