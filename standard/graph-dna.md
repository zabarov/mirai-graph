# Mirai Graph DNA

Status: 1.0 release-candidate standard section

## Purpose

Mirai Graph DNA defines why a graph exists, what it should become and which
principles must guide its growth.

Without DNA, a graph can collect objects and relations but still drift into an
uncontrolled archive. DNA keeps growth aligned with purpose.

## Definition

Graph DNA is the development contract of a graph.

It answers:

- why the graph exists;
- what larger system it serves;
- what kind of growth it should enable;
- which principles cannot be violated;
- which object families belong inside the graph;
- which entity families should become separate graphs;
- how success will be recognized.

## Minimum Fields

```json
{
  "schema_version": "0.1.0",
  "graph_id": "example.graph",
  "purpose": "Why this graph exists.",
  "parent_dna_ref": null,
  "evolution_vector": "Where the graph should develop.",
  "non_negotiable_principles": [],
  "allowed_entity_families": [],
  "success_criteria": []
}
```

## Alignment Rule

Every significant accepted object should be able to explain:

- how it serves the graph purpose;
- what it contributes to the evolution vector;
- what would be harmed if it were missing;
- whether it belongs in this graph or should become a separate graph.

If an object cannot answer these questions, keep it as a draft idea or separate
graph candidate.

## Relationship To Graph Seed

Graph DNA defines what the graph must become.

Graph Seed defines how the first controlled growth step should start.

```text
Graph DNA -> Graph Seed -> Graph Embryo -> Canonical Graph State
```

## Anti-Patterns

- Creating many objects without a purpose.
- Treating every related entity as part of the same graph.
- Adding relation types that do not support the evolution vector.
- Optimizing for local detail while losing the larger system goal.
- Changing DNA silently after downstream artifacts depend on it.
