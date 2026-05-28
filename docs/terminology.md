# GrowGraph Terminology

Status: initial draft

## GrowGraph

An evolutionary graph operating model for managing the growth of complex
systems.

GrowGraph combines canonical graph state, generated context packs, evidence,
readiness, profiles and governance gates.

## Evolutionary Object Graph

The scientific continuity term used in earlier research materials. GrowGraph is
the public working name for the same model direction.

## Complex System

A system with many interacting parts, changing goals, dependencies, evidence,
decisions and feedback loops.

Examples include projects, products, organizations, research programs and
human-AI systems.

## Object

A stable graph entity that represents something the system needs to track.

Examples:

- feature;
- requirement;
- decision;
- component;
- risk;
- task;
- evidence item;
- governance gate.

## Relation

A typed connection between two objects.

Examples:

- depends on;
- implements;
- blocks;
- supports;
- contradicts;
- evidences;
- governs;
- supersedes.

## Canonical Graph State

The maintained source-of-truth graph state. It should have stable object
identity, typed relations, evidence links, lifecycle/readiness fields and
governance rules.

## Generated Context Pack

A task-specific context package generated from canonical graph state.

It helps a human or AI assistant perform a specific task, but it is not itself
the canonical source of truth.

## Graph Seed

The smallest useful starting structure for a GrowGraph model. A seed captures
the initial objects, relations, evidence boundaries and intended growth path.

## Graph Embryo

An early graph state that has grown beyond a seed but is not yet mature enough
to be treated as a stable canonical model.

## Evidence

Material that supports, explains or constrains a graph object, relation,
decision or claim.

Evidence can include documents, source records, experiments, reviews, logs,
published sources or synthetic examples. Evidence level must be explicit.

## Readiness

A maturity state that indicates whether an object, relation, decision, context
pack or standard section is draft, review-ready, accepted, blocked, deprecated
or otherwise constrained.

## Profile

A domain-specific adaptation of the core GrowGraph model.

Profiles may define additional object kinds, relation types, readiness rules,
governance gates and examples without changing the core standard.

## Governance Gate

A rule or checkpoint that controls whether a proposed update, claim, generated
context pack or action may proceed.

Governance gates separate:

- suggestion from decision;
- generated context from canonical state;
- evidence from claim;
- planning from action;
- private material from public release.

## Conformance Level

A declared level showing how completely an implementation follows the GrowGraph
standard.

Conformance levels should be testable with schemas, examples, fixtures and
validation rules.
