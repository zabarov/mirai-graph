# Mirai Graph Evidence Package v0.2

Status: historical alpha research package

## Purpose

This package is the current public evidence entrypoint for Mirai Graph alpha. It
connects executable validation, synthetic baseline comparison, public-safe
pilots and scientific claim boundaries.

It does not claim peer-reviewed proof of effectiveness.

## Hypotheses Under Test

H1. Graph-structured project state can reduce task-context size while
preserving relevant dependencies.

H2. Evidence-linked relations can reduce missed dependencies and unsupported
assumptions in AI-assisted work.

H3. Launch records, process transitions and process-control gates can reduce
false progress claims, especially treating readiness as execution.

H4. Recovery, source-boundary and Kaizen records can improve continuation across
long-running human-AI workflows.

H5. Domain profiles can make Mirai Graph usable beyond software projects,
including AI employees, research programs and organization governance.

H6. Instrumentation artifacts can make AI-assisted work more observable by
linking cockpit signals, feature implementation traceability and multi-source
quality feedback to explicit transition decisions.

## Evidence Inventory

| Evidence type | Public artifact | Current role | Evidence level |
| --- | --- | --- | --- |
| Synthetic benchmark | `benchmarks/synthetic-context-reduction-v0/` | Context-reduction demonstration | Synthetic |
| Context-pack result | `benchmarks/synthetic-context-reduction-v0/results/context-pack.json` | Expected context-pack shape | Synthetic |
| Baseline comparison | `benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json` | Baseline-vs-Mirai Graph metrics | Synthetic |
| Process-transition fixtures | `examples/process-transition-minimal/` | False-transition guard checks | Synthetic |
| Instrumentation layer | `examples/instrumentation-layer-minimal/` | Cockpit, traceability and multi-source feedback shape | Synthetic |
| Playground report | `playground/demo-report.md` | End-to-end local demo | Synthetic |
| Pilot 001 | `pilots/independent-implementation-001-conference-planning/` | Project-management applicability | Public-safe pilot |
| Pilot 002 | `pilots/independent-implementation-002-software-specification/` | Software-specification applicability | Public-safe pilot |
| Pilot 003 | `pilots/independent-implementation-003-ai-employee-workflow/` | AI-employee applicability | Public-safe pilot |
| Pilot 004 | `pilots/independent-implementation-004-research-program/` | Research-program applicability | Public-safe pilot |
| Pilot 005 | `pilots/independent-implementation-005-organization-governance/` | Organization-governance applicability | Public-safe pilot |

## Metrics

Current executable metrics:

- context units;
- context reduction percent;
- missed dependency count;
- unsupported assumption count;
- evidence coverage;
- false progress claims;
- process-transition validity;
- missing transition evidence count;
- profile conformance validity;
- instrumentation report validity;
- public-safety gate verdict.

Metrics still needing stronger study:

- time to relevant context;
- time to validated completion;
- reviewer effort;
- rework cycles;
- inter-reviewer agreement;
- downstream implementation quality;
- external adopter success rate.

## Reproducibility Commands

Run the current public evidence suite:

```bash
npm test
npm run release:check
```

Run focused evidence commands:

```bash
npm run benchmark:synthetic
npm run validate:baseline-comparison
npm run validate:process-transition
npm run validate:process-transition-report
npm run validate:instrumentation-layer
npm run validate:pilots
npm run validate:profile-results
npm run playground:report
```

Run unified CLI report commands:

```bash
node packages/cli/mirai-graph.js report validation examples/minimal-graph
node packages/cli/mirai-graph.js explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
node packages/cli/mirai-graph.js report playground
```

## Interpretation Rules

- Synthetic evidence demonstrates method shape and validator behavior.
- Public pilots demonstrate profile applicability, not universal
  effectiveness.
- Baseline comparison artifacts are bounded examples, not broad empirical
  proof.
- Passing validators prove conformance to current alpha checks only.
- Generated context is not canonical state.
- Evidence, feedback, runtime results and proposals do not authorize canonical
  updates.

## Current Evidence Verdict

Mirai Graph alpha currently supports these claims:

- a public executable standard draft exists;
- schemas, validators, starter templates and examples are runnable;
- process transitions can be explained and fail closed on known invalid
  transitions;
- instrumentation reports can connect cockpit signals, feature traceability and
  multi-source feedback to transition decisions;
- synthetic baseline comparison can record context, evidence and assumption
  metrics;
- public-safe pilots cover software, AI employee, research-program and
  organization-governance scenarios.

Mirai Graph alpha does not yet support these claims:

- peer-reviewed effectiveness;
- production autonomous execution safety;
- universal superiority over documents, chats or task trackers;
- country-scale governance validity;
- external validity across unrelated organizations;
- automatic correctness of generated context.

## Next Evidence Work

- Add at least one public-safe external adopter pilot outside the original
  Mirai Graph authoring contour.
- Add reviewer packets and inter-reviewer agreement records.
- Replicate baseline comparison across research, organization governance and
  product-roadmap scenarios.
- Add limitation tables per pilot.
- Prepare a publication-ready reproducibility bundle.
