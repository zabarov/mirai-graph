# Mirai Graph Evidence Package v0.3

Status: 1.0 release-candidate public evidence package

## Purpose

This package is the current public evidence entrypoint for Mirai Graph
`1.0.0-rc.4`. It connects three evidence layers:

1. Synthetic benchmark and baseline comparison.
2. Executable instrumentation artifacts.
3. Public-safe independent implementation pilots.

It is designed for external readers who need to understand what Mirai Graph can
currently demonstrate, what remains unproven and how to reproduce the public
checks.

It does not claim peer-reviewed proof of effectiveness.

## Evidence Maturity Summary

| Layer | What exists | What it supports | What it does not support |
| --- | --- | --- | --- |
| Synthetic benchmark | `benchmarks/synthetic-context-reduction-v0/` | bounded context reduction and dependency-preservation measurement | broad productivity or quality claims |
| Baseline comparison | `results/baseline-comparison-result.json` | explicit baseline-vs-graph metrics on one public-safe task | external validity |
| Process fixtures | `examples/process-transition-minimal/` | fail-closed transition validation and readable explanations | runtime execution safety |
| Instrumentation | `examples/instrumentation-layer-minimal/` | cockpit, traceability and multi-source feedback shape | prediction of real production outcomes |
| Character Layer | `examples/character-layer-readiness-1-0/` | reusable behavior-governance profile, integration shape and portability evidence format | proof of broad model equivalence or production replacement safety |
| Dynamic Episode | `examples/dynamic-episode-minimal/` | event-to-decision trace shape, blocked alternatives and feedback routing | proof of reduced drift in real code generation |
| Public pilots | `pilots/independent-implementation-001..005-*` | profile applicability across domains | proof of real-world effectiveness |
| Adopter kit | `docs/adoption/adopter-kit.md` | repeatable first adoption path | successful adoption without review |

## Hypotheses Under Test

H1. Graph-structured state can reduce task-context size while preserving
relevant dependencies.

H2. Evidence-linked relations can reduce missed dependencies and unsupported
assumptions in AI-assisted work.

H3. Launch records, process transitions and technology quality feedback can
reduce false progress claims, especially treating readiness as execution.

H4. Development cockpit, traceability and multi-source feedback artifacts can
make AI-assisted work more observable.

H5. Domain profiles can make the same graph model usable across software,
research, AI employee and organization-governance scenarios.

H6. A role-oriented adopter kit can reduce first-use ambiguity for external
evaluators.

H7. Externalized Character Layer constraints can improve behavior portability
across model backends when measured through the same graph context, task set and
fixtures.

These are hypotheses and engineering claims under test, not settled scientific
facts.

## Public Evidence Inventory

| Evidence | Artifact | Reproducibility command | Evidence level |
| --- | --- | --- | --- |
| Package validation | `examples/minimal-graph/` | `npm run validate:minimal` | Synthetic conformance |
| Context reduction | `benchmarks/synthetic-context-reduction-v0/` | `npm run benchmark:synthetic` | Synthetic metric |
| Baseline comparison | `benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json` | `npm run validate:baseline-comparison` | Synthetic comparison |
| Process transition | `examples/process-transition-minimal/` | `npm run validate:process-transition` | Executable fixture |
| Process explanation report | `examples/process-transition-minimal/results/` | `npm run validate:process-transition-report` | Executable fixture |
| Technology feedback | `examples/technology-quality-feedback-minimal/` | `npm run validate:technology-quality-feedback` | Executable fixture |
| Instrumentation layer | `examples/instrumentation-layer-minimal/` | `npm run validate:instrumentation-layer` | Executable fixture |
| Instrumentation report | `examples/instrumentation-layer-minimal/` | `npm run validate:instrumentation-report` | Readable report |
| Character Layer readiness | `examples/character-layer-readiness-1-0/` | `npm run validate:character-layer-readiness` | Profile readiness |
| Model portability evidence | `examples/model-portability-minimal/` | `npm run validate:model-portability-evidence` | Synthetic comparison shape |
| Adopter workflow | `docs/adoption/adopter-kit.md` and templates | `npm run validate:adopter-workflow` | Adoption readiness |
| Public pilots | `pilots/independent-implementation-*` | `npm run validate:pilots` | Public-safe pilot |
| Full release check | repository root | `npm run release:check` | Integrated validation |

## Pilot Coverage Matrix

| Pilot | Domain | Profile | Main question | Current verdict |
| --- | --- | --- | --- | --- |
| 001 | Conference planning | `project_management` | Can public materials produce a valid small workflow package? | `pass_with_notes` |
| 002 | Software specification | `software_specification` | Can public materials produce a valid software-specification package? | `pass_with_notes` |
| 003 | AI employee workflow | `ai_employee` | Can the graph model an AI employee as governance surface, not prompt only? | validates with boundaries |
| 004 | Research program | `project_management` | Can the graph model evidence, limitations and publication gates? | validates with boundaries |
| 005 | Organization governance | `organization_governance` | Can the graph model strategy, controls, metrics, feedback and Kaizen? | validates with boundaries |

## Current Measured Signals

The public suite currently measures or validates:

- package conformance;
- profile conformance;
- graph seed validity;
- context-pack shape;
- context units;
- context reduction percent;
- missed dependency count;
- unsupported assumption count;
- evidence coverage;
- false progress claims;
- process-transition validity;
- missing transition evidence;
- technology-feedback classification;
- instrumentation report validity;
- character-layer readiness;
- model-portability evidence shape;
- pilot package validity;
- public-safety boundaries.

The synthetic context-reduction benchmark currently records:

- baseline context units: `620`;
- Mirai Graph context units: `270`;
- context reduction: `56.4516%`;
- baseline missed dependencies: `2`;
- Mirai Graph missed dependencies: `0`.

These numbers are useful as a reproducible synthetic demonstration. They are
not broad empirical proof.

## Interpretation Rules

- Synthetic evidence demonstrates method shape and validator behavior.
- Public pilots demonstrate profile applicability and adoption shape.
- Baseline comparison artifacts are bounded examples, not broad empirical
  studies.
- Passing validators prove conformance to current release-candidate checks
  only.
- Generated context is not canonical state.
- Evidence, feedback, runtime results and proposals do not authorize canonical
  updates.
- Cockpit scores are steering signals, not release authorization.
- A pilot report is evidence of a completed public-safe exercise, not proof of
  real-world outcome improvement.

## Reproducibility Bundle

Run:

```bash
npm install
npm run release:check
```

Focused checks:

```bash
npm run benchmark:synthetic
npm run validate:baseline-comparison
npm run validate:process-transition
npm run validate:process-transition-report
npm run validate:technology-quality-feedback
npm run validate:instrumentation-layer
npm run validate:instrumentation-report
npm run validate:character-layer-readiness
npm run validate:model-portability-evidence
npm run validate:pilots
npm run validate:profile-results
npm run validate:adopter-workflow
npm run playground:report
```

Readable reports:

```bash
node packages/cli/mirai-graph.js report validation examples/minimal-graph
node packages/cli/mirai-graph.js explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
node packages/cli/mirai-graph.js report instrumentation examples/instrumentation-layer-minimal
node packages/cli/mirai-graph.js report playground
```

## Current Evidence Verdict

Mirai Graph `1.0.0-rc.4` supports these bounded claims:

- a public executable standard draft exists;
- schemas, validators, templates, examples and pilots are runnable;
- process transitions can be validated, explained and failed closed;
- technology quality feedback can classify findings and block unsafe
  acceptance;
- instrumentation can connect cockpit signals, feature traceability and
  multi-source feedback to transition decisions;
- Character Layer can represent reusable behavior governance, cross-layer
  integration and bounded model-portability evidence;
- Dynamic Episode traces can record a selected path, blocked alternatives,
  evidence refs, finding classification and feedback routing for one governed
  episode;
- synthetic baseline comparison can record context, evidence and assumption
  metrics;
- public-safe pilots cover project-management, software-specification,
  AI-employee, research-program and organization-governance scenarios;
- the adopter kit gives a reproducible first-use path.

Mirai Graph `1.0.0-rc.4` does not yet support these claims:

- peer-reviewed effectiveness;
- production autonomous execution safety;
- universal superiority over documents, chats or task trackers;
- country-scale governance validity;
- external validity across unrelated organizations;
- automatic correctness of generated context;
- automatic canonical update authorization from evidence, feedback or
  proposals.

## Next Evidence Work

- Finish npm publication so reproduction can use published package install
  rather than repository checkout.
- Add a public-safe pilot with an external reviewer packet and response notes.
- Replicate baseline comparison across at least two more domains:
  research-program and organization-governance.
- Add pilot limitation tables with the same fields across all pilots.
- Add reviewer-effort and time-to-relevant-context metrics.
- Prepare a publication-ready reproducibility bundle that cites this package as
  the current release-candidate evidence index.

## Public Safety Boundary

This package intentionally excludes:

- private project paths;
- customer data;
- credentials and tokens;
- private handoffs;
- internal runtime traces;
- unpublished private evaluation payloads.

Private pilots may inform future standard improvements, but public evidence
must stay synthetic, public-safe, bounded and reproducible.
