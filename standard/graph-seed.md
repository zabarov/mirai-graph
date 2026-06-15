# Mirai Graph Seed

Status: 1.0 release-candidate standard section

## Purpose

A Graph Seed is the controlled starting package for growing a Mirai Graph model.

Complex systems should not start as large hand-authored graphs. They should
start from a small seed that defines purpose, source boundaries, growth rules,
review gates and stop conditions.

## Definition

A Graph Seed is a machine-readable growth contract.

It answers:

- what graph should exist;
- why it should exist;
- which profile shapes it;
- what sources may be used;
- which object and relation families are allowed;
- what must be reviewed before canonical write;
- when growth should stop.

## Growth Flow

```text
graph seed
-> profile expansion
-> candidate extraction
-> graph embryo
-> review packet
-> canonical accept
-> generated indexes/context/reports
-> readiness score
-> seed evolution
```

## Minimum Seed Fields

```json
{
  "schema_version": "0.1.0",
  "seed_id": "seed.example",
  "target_graph_id": "example.graph",
  "purpose": "Why this graph should exist.",
  "target_profile": "profile.software_specification",
  "target_mode": "discovery",
  "graph_dna": {
    "purpose": "Parent DNA draft.",
    "evolution_vector": "How the graph should develop.",
    "non_negotiable_principles": []
  },
  "source_boundaries": {
    "allowed_sources": [],
    "excluded_sources": [],
    "canonical_write_allowed": false
  },
  "growth_rules": {
    "allowed_object_families": [],
    "allowed_relation_families": [],
    "max_initial_objects": 20,
    "depth_mode": "light"
  },
  "review_gates": [
    "human_review_before_canonical_write",
    "validate_before_generated_context"
  ],
  "generated_views": [
    "seed_preview",
    "candidate_object_list",
    "growth_gap_report"
  ],
  "stop_conditions": []
}
```

## Target Modes

Initial target modes:

- `discovery`: understand a messy domain;
- `canonical`: prepare reviewed canonical graph state;
- `pilot`: support measured pilot work;
- `controlled_runtime`: support bounded runtime use with fallback;
- `production_runtime`: broad runtime use after repeated evidence.

## Human Control Rule

The user should not need to inspect the full graph first.

The seed should produce controlled views:

- seed summary;
- candidate objects;
- candidate relations;
- evidence gaps;
- risk view;
- readiness view;
- next-action view.

## Stop Conditions

Stop seed expansion when:

- purpose is vague;
- target profile is missing;
- source boundaries are unclear;
- candidate count exceeds growth budget;
- relation families are invented ad hoc;
- generated preview cannot explain why objects belong;
- canonical write is requested before review.

## Anti-Patterns

- Starting with the whole organization as one graph.
- Letting AI extraction write directly to canonical state.
- Expanding sources beyond the seed boundary.
- Treating a seed as the full graph.
- Ignoring stop conditions because the generated output looks useful.
