# GrowGraph Lifecycle And Readiness

Status: initial public draft

## Purpose

Lifecycle and readiness rules describe how GrowGraph objects, relations,
context packs and standard sections move from early ideas to accepted canonical
state.

Readiness is not the same as task status. It records whether a graph element is
mature enough to be used as trusted context, implementation input or governance
evidence.

## Core Readiness Values

### `draft`

The element exists but is incomplete, unreviewed or exploratory.

Use for:

- early graph-seed objects;
- unreviewed relations;
- initial examples;
- newly imported material.

### `review_ready`

The element is structured enough for review.

Use for:

- candidate objects with evidence;
- candidate relations with clear source and target;
- context packs prepared for human review;
- standard sections ready for critique.

### `accepted`

The element has passed the relevant review or governance gate and may be used
as canonical state.

Use for:

- stable objects;
- approved relations;
- accepted evidence records;
- reviewed standard sections.

### `blocked`

The element cannot progress until a blocker is resolved.

Use for:

- missing evidence;
- unresolved contradiction;
- privacy or licensing issue;
- governance approval requirement;
- unsafe action boundary.

### `deprecated`

The element remains traceable but should not be used for new work.

Use for:

- superseded objects;
- old relation types;
- obsolete profiles;
- retired context-pack rules.

## Lifecycle Flow

Typical flow:

```text
draft -> review_ready -> accepted
draft -> blocked -> draft
review_ready -> blocked -> review_ready
accepted -> deprecated
accepted -> blocked
```

An accepted element may become blocked if new evidence creates a serious
conflict or governance issue.

## Object Lifecycle

An object may move to `review_ready` when it has:

- stable `id`;
- `kind`;
- `title`;
- `summary`;
- readiness value;
- profile;
- evidence boundary or explicit reason why evidence is not yet available.

An object may move to `accepted` when:

- it has been reviewed for meaning;
- its evidence is sufficient for the current use;
- it does not duplicate another accepted object;
- privacy and public-safety rules are satisfied.

## Relation Lifecycle

A relation may move to `review_ready` when it has:

- stable `id`;
- relation `type`;
- existing `source` object;
- existing `target` object;
- evidence or explicit rationale;
- directionality checked.

A relation may move to `accepted` when:

- source and target are correct;
- relation type is appropriate;
- direction is correct;
- evidence is sufficient;
- contradiction handling is complete.

## Context-Pack Lifecycle

A generated context pack starts as `draft` unless it is produced by an accepted
and validated generation procedure.

A context pack may be `accepted` only for a specific task, time and evidence
boundary. It must not replace canonical graph state.

## Governance Lifecycle

Governance gates can block:

- canonical updates;
- public release;
- generated context use;
- automated action;
- claims about validation or readiness.

When a governance gate blocks progress, record:

- blocked element;
- reason;
- owner or reviewer;
- required evidence;
- next review point.

## Anti-Patterns

- Treating `draft` graph elements as authoritative.
- Using generated context as canonical state.
- Marking elements `accepted` without evidence or review.
- Hiding contradictions by deleting blocked elements.
- Reusing a context pack outside its task boundary.
