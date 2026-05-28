# GrowGraph Profiles

Status: initial public draft

## Purpose

Profiles adapt GrowGraph to domains without changing the core standard.

A profile may define additional object kinds, relation types, readiness rules,
governance gates, examples and adoption guidance.

## Profile

A profile is a named specialization of GrowGraph.

Example profiles:

- `core`;
- `software_specification`;
- `project_management`;
- `product_development`;
- `organization_governance`;
- `research_program`;
- `human_ai_system`;
- `public_sector_governance`.

## Profile Rules

A profile may extend:

- object kinds;
- relation types;
- evidence levels;
- readiness policies;
- governance gates;
- examples;
- validation fixtures.

A profile should not:

- override core semantics silently;
- weaken public-safety rules;
- claim conformance without tests;
- mix private domain material into public examples.

## Core Profile

The `core` profile contains model elements expected across implementations:

- stable objects;
- typed relations;
- evidence;
- readiness;
- generated context packs;
- governance gates;
- conformance levels.

## Software Specification Profile

Initial example profile used by the synthetic benchmark.

Possible object kinds:

- package;
- feature;
- requirement;
- constraint;
- risk;
- component;
- task;
- evidence.

Possible relation types:

- implements;
- depends_on;
- blocks;
- evidences;
- generates;
- related_to.

## Profile Conformance

Profile conformance should be declared separately from core conformance.

Example:

```text
Core conformance: Level 1
Profile conformance: software_specification Level 1
```

## Open Questions

- Should profiles have machine-readable manifests?
- Should profiles declare allowed object kinds and relation types?
- Should profile validation be strict by default or advisory?
- How should cross-profile conflicts be resolved?
