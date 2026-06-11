# Development Cockpit

Development Cockpit is a Mirai Graph instrumentation layer for steering governed work by observable signals instead of chat memory or informal confidence.

It does not replace tests, review, approval, release gates, or canonical graph updates. It aggregates evidence-backed indicators so a coordinator can see whether a work system is on course, drifting, blocked, or ready for the next governed transition.

## Purpose

Development Cockpit is used when a project needs a compact operating view over:

- trajectory toward the current goal;
- graph coverage and implementation coverage;
- evidence confidence;
- documentation and code-location traceability;
- quality and architecture integrity;
- security, drift, blockers, dependencies, and next action.

The cockpit is intentionally an instrument panel. It can recommend a next action, but it cannot authorize execution, approval, release, or canonical update by itself.

## Required Model

A cockpit report must declare:

- `subject_ref`: the project, package, process, or work batch being observed;
- `generated_at`: when the report was produced;
- `instruments`: observable indicators with score, band, status, reason, and evidence references;
- `readiness`: separated readiness signals for developer testing, product maturity, production, and external user testing;
- `next_best_action`: a bounded recommended action with target cycle and required gates;
- `blocking_rules`: conditions that stop transition even when aggregate scores look high;
- `limitations`: boundary language that prevents confusing metrics with acceptance.

## Instrument Rules

Each instrument should be evidence-backed. Missing evidence is a signal, not a reason to fabricate confidence.

Recommended instrument families:

- `trajectory`: alignment with goal, DNA, scope, and current milestone;
- `graph_coverage`: whether relevant objects, relations, dependencies, and lifecycle states are represented;
- `implementation_coverage`: whether planned work maps to concrete implementation and evidence;
- `evidence_confidence`: whether evidence is current, reproducible, and tied to the right claims;
- `traceability`: whether features connect to specs, code, tests, documentation, and review;
- `quality`: test health, semantic review, technology adherence, and defect patterns;
- `architecture`: ownership boundaries, dependency shape, and source-boundary conformance;
- `risk`: blockers, drift, security findings, release risks, and recovery options.

## Transition Boundary

Development Cockpit can support a transition decision only when paired with the relevant gate:

```text
cockpit signal -> transition request -> required evidence -> gate validation -> decision
```

High cockpit readiness is not execution, implementation, acceptance, release, or approval.

## Kaizen Use

Cockpit signals should feed Kaizen when they reveal repeatable process issues:

- repeated missing evidence;
- recurring dependency drift;
- frequent reviewer corrections;
- weak traceability between feature intent and implementation;
- mismatch between tests and semantic acceptance.

The Kaizen output is a classified improvement or proposal, not an automatic canonical update.
