# Mirai Graph Object Model

Status: 1.0 release-candidate standard section

## Purpose

The object model defines the stable entities that a Mirai Graph implementation
tracks inside canonical graph state.

Objects are not free-form notes. They are addressable units of system state
that can be linked, evidenced, reviewed, matured and governed.

## Object

An object is a stable graph entity.

Examples:

- project;
- product;
- requirement;
- feature;
- decision;
- risk;
- task;
- component;
- policy;
- stakeholder;
- evidence item;
- governance gate.

## Minimum Fields

A Mirai Graph object should include:

```json
{
  "id": "object.unique_id",
  "kind": "feature",
  "title": "Short human-readable title",
  "summary": "Brief description of the object",
  "readiness": "draft",
  "evidence": [],
  "profile": "core",
  "created_at": "2026-05-28",
  "updated_at": "2026-05-28"
}
```

## Field Semantics

### `id`

A stable unique identifier. The identifier should remain stable across file
moves, generated context packs and implementation exports.

### `kind`

The object category. Core kinds should be standardized; profiles may add
domain-specific kinds.

### `title`

A short label for humans.

### `summary`

A concise explanation of what the object represents.

### `readiness`

The maturity state of the object. Early values may include:

- `draft`;
- `review_ready`;
- `accepted`;
- `blocked`;
- `deprecated`.

### `evidence`

References to evidence records or source materials. Evidence links should not
embed private data directly in public examples.

### `profile`

The profile that defines or specializes the object. The default profile is
`core`.

### `created_at` And `updated_at`

Dates or timestamps used for lifecycle tracking.

## Core Object Kinds

Initial core kinds:

- `system`;
- `goal`;
- `requirement`;
- `feature`;
- `decision`;
- `risk`;
- `task`;
- `component`;
- `evidence`;
- `context_pack`;
- `governance_gate`;
- `profile`.

## Object Boundary Rules

An object should be created when the item needs at least one of:

- stable identity;
- relations to other objects;
- evidence;
- readiness tracking;
- governance control;
- generated context inclusion;
- reuse across tasks.

An object should not be created for:

- a one-off sentence with no reuse value;
- raw private data copied without review;
- generated AI text that has not been accepted into canonical state;
- a vague idea with no boundary or owner.

## Public Example

```json
{
  "id": "feature.notify_after_approval",
  "kind": "feature",
  "title": "Notify after approval",
  "summary": "Send a notification when a content item is approved.",
  "readiness": "draft",
  "evidence": ["source.content_workflow"],
  "profile": "software_specification",
  "created_at": "2026-05-28",
  "updated_at": "2026-05-28"
}
```

## Open Questions

- Should `owner`, `status` and `readiness` be separate fields?
- Should evidence be modeled as first-class objects only, or also as inline
  references?
- Which object kinds belong to `core` and which belong to profiles?
- Should timestamps be ISO dates or full date-time strings?
