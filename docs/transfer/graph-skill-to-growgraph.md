# From `$graph` Skill To Mirai Graph

Status: initial transfer map

## Purpose

This note defines how reusable knowledge from the practical `$graph` skill
should move into the public Mirai Graph repository.

## Transfer Rule

`$graph` is the practical methodology owner. Mirai Graph is the public standard
and adoption layer.

Transfer a concept only when it is:

- reusable outside the original skill;
- safe for public release;
- not tied to private SIMAI or customer material;
- useful for standards, tooling, profiles, examples or research evidence.

## Transfer Classes

### Standard Concept

Belongs in:

- `standard/`
- `schemas/`

Examples:

- object model;
- relation model;
- lifecycle/readiness;
- evidence/provenance;
- governance gates;
- conformance levels.

### Profile Concept

Belongs in:

- `standard/profiles.md`
- future `profiles/`

Examples:

- software specification profile;
- project management profile;
- organization governance profile;
- research program profile.

### Reference Tooling

Belongs in:

- `packages/`
- `schemas/`
- `examples/`

Examples:

- validators;
- generators;
- benchmark runners;
- migration helpers.

### Research Artifact

Belongs in:

- `benchmarks/`
- `publications/`
- `docs/research/`

Examples:

- experiment protocol;
- result note;
- reproducibility package;
- validation roadmap.

### Private Or Local Material

Does not belong in public Mirai Graph.

Examples:

- raw internal project materials;
- internal chats;
- private skill implementation details not approved for release;
- customer or employee data;
- secrets;
- private metrics without redaction and approval.

## Initial Mapping

| `$graph` Area | Mirai Graph Destination | Notes |
| --- | --- | --- |
| Graph Seed | `standard/`, `docs/adoption/` | Should become a public seed method. |
| Graph Embryo | `standard/`, `docs/adoption/` | Useful for staged graph growth. |
| Lifecycle/readiness | `standard/lifecycle-readiness.md` | Already started. |
| Relation/impact model | `standard/relation-model.md` | Needs richer impact semantics. |
| AI context generation | `standard/context-pack-generation.md` | Needs schema and generator. |
| Measure-convert-optimize | `docs/research/`, `benchmarks/` | Core validation methodology. |
| Graph method evolution | `docs/research/` | Core practice-to-science loop. |
| Federation contracts | future `standard/federation.md` | Later stage. |
| Runtime policies | future `standard/governance.md` expansion | Public-safe subset only. |

## Next Transfer Batch

1. Draft graph DNA, graph seed and graph embryo public standard sections.
2. Create graph seed and graph embryo schemas.
3. Extend the CLI with seed validation.
4. Draft measure-convert-optimize experiment protocol.
5. Add profile manifests for the first public profiles.

Current gap report:

`docs/transfer/standard-gap-report-2026-05-28.md`

Current capability map:

`docs/transfer/graph-capability-map-2026-05-29.md`

The dated capability map is the current public-safe transfer state. The
2026-05-28 gap report is retained as a historical baseline.
