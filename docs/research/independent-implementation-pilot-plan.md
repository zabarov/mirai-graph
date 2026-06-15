# Independent Implementation Pilot Plan

Status: 1.0 release-candidate research plan

## Purpose

This plan defines the first public-safe path for testing whether Mirai Graph can
be implemented outside its original practical `$graph` environment.

## Research Question

Can an independent implementer follow the public Mirai Graph standard and create
a valid Level 1 package without access to private internal materials?

## Hypothesis

Given the public standard, schemas, examples and validator, an implementer can
create a valid Mirai Graph package for a small project or workflow.

## Pilot Scope

Recommended first scope:

- one small software project;
- one project-management workflow;
- one research-program workflow.

Each pilot should produce:

- `mirai-graph-package.json`;
- `graph/objects.json`;
- `graph/relations.json`;
- optional `gates/results.json`;
- validation output;
- reviewer notes.

## Procedure

1. Provide only public Mirai Graph materials.
2. Ask implementer to choose a small public-safe domain.
3. Create a graph seed.
4. Generate or manually draft a graph embryo.
5. Review candidate objects and relations.
6. Write canonical package files.
7. Run validator.
8. Record time, blockers, confusing sections and missing concepts.
9. Produce a pilot report.

## Metrics

- time to first valid package;
- validation errors;
- warnings;
- number of clarification questions;
- missing standard sections;
- object/relation quality review;
- evidence boundary quality;
- implementation confidence.

## Acceptance

Pilot passes when:

- package validates;
- implementer can explain object and relation choices;
- evidence boundary is explicit;
- no private material is included;
- limitations are recorded.

## Research Use

This pilot can support claims about standard usability and implementation
clarity. It cannot prove external effectiveness, runtime safety or universal
validity.
