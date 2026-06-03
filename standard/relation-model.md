# Mirai Graph Relation Model

Status: initial public draft

## Purpose

The relation model defines typed links between Mirai Graph objects.

Relations make system dependencies, evidence links, governance boundaries and
growth paths explicit.

## Relation

A relation is a typed directional connection from one object to another.

Example:

```json
{
  "id": "relation.feature.notify_after_approval.depends_on.feature.approval_flow",
  "type": "depends_on",
  "source": "feature.notify_after_approval",
  "target": "feature.approval_flow",
  "readiness": "draft",
  "evidence": ["source.notification_delivery"],
  "profile": "software_specification"
}
```

## Minimum Fields

A Mirai Graph relation should include:

```json
{
  "id": "relation.unique_id",
  "type": "depends_on",
  "source": "object.source_id",
  "target": "object.target_id",
  "readiness": "draft",
  "evidence": [],
  "profile": "core"
}
```

## Field Semantics

### `id`

A stable identifier for the relation.

### `type`

The relation category. Core relation types should be standardized; profiles may
add domain-specific relation types.

### `source`

The object where the directed relation starts.

### `target`

The object where the directed relation ends.

### `readiness`

The maturity state of the relation.

### `evidence`

Evidence supporting the relation.

### `profile`

The profile that defines or specializes the relation.

## Core Relation Types

Initial core relation types:

- `depends_on`;
- `supports`;
- `blocks`;
- `implements`;
- `evidences`;
- `contradicts`;
- `governs`;
- `requires_approval_from`;
- `generates`;
- `derived_from`;
- `supersedes`;
- `belongs_to`;
- `related_to`.

## Relation Boundary Rules

A relation should be created when the connection changes how the system is
understood, governed, implemented or evaluated.

A relation should not be created when:

- the link is merely decorative;
- the relation type is unclear;
- there is no source and target object;
- it embeds a private source detail that should remain outside public graph
  state;
- it is generated but not accepted into canonical state.

## Directionality

Relations should be directional unless the relation type explicitly defines
symmetry.

Example:

`feature.notify_after_approval depends_on feature.approval_flow`

does not mean:

`feature.approval_flow depends_on feature.notify_after_approval`

## Evidence And Confidence

The initial draft requires evidence links but does not yet define a confidence
field. Future versions may add:

- confidence;
- review status;
- reviewer;
- source type;
- extraction method.

## Open Questions

- Should relation confidence be required?
- Should relation IDs be generated or human-authored?
- Should `related_to` be allowed in mature canonical graphs, or only during
  early graph-seed work?
- How should contradictory relations be represented and resolved?
