# Mirai Graph Standard v0.1 Draft

Status: historical v0.1 standard draft

## Purpose

This document defines the first public draft of the Mirai Graph standard: an
implementation-independent graph operating model for managing the growth of
complex systems.

The draft is intentionally incomplete. It establishes the core sections,
normative direction and conformance path for future implementation pilots.

## Normative Language

This draft uses plain language. Future versions may adopt RFC-style terms such
as `MUST`, `SHOULD` and `MAY` after the object, relation and conformance models
are stable.

## Standard Scope

Mirai Graph standardizes:

- canonical graph state;
- object identity and object kinds;
- typed relations;
- evidence and provenance;
- readiness and lifecycle state;
- generated context packs;
- profiles;
- governance gates;
- conformance levels;
- validation fixtures.

## Non-Scope

Mirai Graph does not standardize:

- one database engine;
- one programming language;
- one UI;
- one AI-agent framework;
- one organizational management methodology;
- private project data;
- claims of universal validity.

## Core Model

A Mirai Graph implementation maintains a canonical graph state and can generate
task-specific context packs from that state.

The canonical graph state contains:

- objects;
- relations;
- evidence links;
- readiness/lifecycle fields;
- profile metadata;
- governance records where applicable.

A generated context pack is a temporary, task-specific view. It helps a human
or AI system act with relevant context, but it is not the source of truth.

## Required Standard Sections

The public standard is expected to contain:

- [Object Model](object-model.md)
- [Relation Model](relation-model.md)
- [Graph DNA](graph-dna.md)
- [Graph Seed](graph-seed.md)
- [Graph Embryo](graph-embryo.md)
- [Lifecycle And Readiness](lifecycle-readiness.md)
- [Evidence And Provenance](evidence-provenance.md)
- `context-pack-generation.md`
- [Governance](governance.md)
- [Hybrid Source Of Truth](hybrid-source-of-truth.md)
- [Adoption Levels](adoption-levels.md)
- [Projection Views](projection-views.md)
- [Runtime Enablement](runtime-enablement.md)
- [Graph As AI Brain](graph-as-ai-brain.md)
- [Action Runtime Boundary](action-runtime-boundary.md)
- [Feedback Learning Gate](feedback-learning-gate.md)
- [Profiles](profiles.md)
- [Conformance Levels](conformance-levels.md)
- [Test Suite](test-suite.md)

Only the first sections are drafted in this initial public batch.

## Minimum Implementation Idea

A minimal Mirai Graph package should be able to represent:

1. A set of stable objects.
2. Typed relations between those objects.
3. Evidence references for important claims.
4. Readiness state for objects or decisions.
5. A generated context pack for one task.
6. A boundary between canonical state and generated context.

## Conformance Direction

Future conformance levels:

- Level 0: terminology alignment;
- Level 1: canonical graph state;
- Level 2: context-pack generation;
- Level 3: governance-gated operation;
- Level 4: profiled multi-domain operation.

Conformance must be testable with schemas, fixtures and examples.

## Current Readiness

Verdict: `not_standard_ready`

Reason:

The repository now contains the public foundation, terminology, initial object
model, initial relation model, lifecycle/readiness, evidence/provenance,
graph DNA, graph seed, graph embryo, context-pack generation, profiles,
governance, Hybrid Source Of Truth, adoption levels, projection views,
runtime enablement, conformance levels, test-suite direction, initial schemas,
a validator, a minimal example and a synthetic benchmark.

Next required sections:

1. CLI seed preview and embryo generation;
2. stricter context-pack schema;
3. profile manifest schema;
4. richer negative fixtures;
5. independent implementation pilot.
