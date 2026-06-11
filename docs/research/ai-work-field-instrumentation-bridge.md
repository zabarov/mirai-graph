# AI Work Field Instrumentation Bridge

Status: public-safe research bridge

## Purpose

This note connects Mirai Graph instrumentation with the AI Work Field research
framing.

The bridge is intentionally limited: it explains the public model, synthetic
artifacts and evidence boundaries. Private pilot repositories, runtime traces,
customer data, internal policies and unpublished handoff material are not
published as Mirai Graph evidence.

## Research Framing

AI Work Field treats AI-assisted work as a governed trajectory through explicit
state, constraints, evidence, feedback and cockpit signals.

The public Mirai Graph standard maps that framing into reusable artifacts:

- graph state: objects, relations, readiness and evidence;
- process control: launch records, state machines and transition validation;
- technology adherence: technology quality feedback;
- instrumentation: development cockpit, feature implementation traceability
  and multi-source quality feedback;
- improvement loop: Kaizen findings, proposals and controlled updates.

## Instrumentation Hypothesis

The instrumentation layer supports this hypothesis:

```text
AI-assisted work becomes more controllable when feature intent, implementation
evidence, technology adherence, cockpit signals and expert feedback are all
represented as explicit graph-linked artifacts.
```

This is a research hypothesis, not a proven general law.

## Public Evidence Levels

### Synthetic Evidence

Synthetic examples demonstrate schema shape, validator behavior and boundary
rules. They can show that the process is executable and reproducible on toy
cases.

Current artifacts:

- `examples/instrumentation-layer-minimal`;
- `schemas/development-cockpit.schema.json`;
- `schemas/feature-implementation-traceability.schema.json`;
- `schemas/multi-source-quality-feedback.schema.json`;
- `npm run validate:instrumentation-layer`.

Synthetic evidence does not prove real productivity, quality improvement,
production safety or external validity.

### Private Pilot Evidence

Private pilot work can inform the standard by revealing useful abstractions:

- cockpit-style signals for trajectory, coverage, evidence, quality, drift and
  next action;
- feature-to-implementation traceability;
- multi-source feedback from tests, validators, process checks, expert review
  and Kaizen;
- separation between readiness, execution, acceptance, release and canonical
  updates.

Private pilot evidence must be generalized before public transfer. Public Mirai
Graph receives only the abstract pattern, synthetic examples and schemas.

### Scientific Evidence

Scientific evidence requires stronger protocols:

- preregistered or clearly stated hypotheses;
- reproducible datasets or public-safe fixtures;
- metrics and measurement limits;
- independent review or replication where possible;
- limitations and threats-to-validity analysis.

The current public repository supports preparation for that work. It does not
claim peer-reviewed proof.

## Measurement Candidates

Future research can measure:

- context reduction without losing required dependencies;
- missing dependency rate;
- unsupported assumption rate;
- false progress claim rate;
- evidence coverage;
- transition violation detection;
- reviewer correction rate before and after Kaizen;
- feature implementation traceability coverage.

## Boundary Rules

The bridge preserves these Mirai Graph invariants:

- generated context is not canonical state;
- evidence is not approval;
- tests are not acceptance;
- cockpit metrics are not release permission;
- feedback and proposals do not authorize canonical updates;
- Kaizen can propose process changes, but controlled update still requires the
  relevant approval path.

## Reproducibility Path

For public reproduction, use:

```bash
npm run validate:instrumentation-layer
npm run validate:technology-quality-feedback
npm run validate:process-transition
npm run validate:baseline-comparison
npm test
```

For publication work, pair these commands with the evidence packages and
limitations documents already maintained under `docs/research/`.
