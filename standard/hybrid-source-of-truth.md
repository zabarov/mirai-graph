# Hybrid Source Of Truth

Status: alpha standard section

## Purpose

Mirai Graph can act as the first machine-readable layer for routing, context,
capability discovery, readiness, gates and evidence. That does not mean the
graph replaces every original source.

Hybrid Source Of Truth defines how a Mirai Graph implementation can use graph
state for operational control while keeping domain source material authoritative
for meaning, judgement and sensitive procedures.

## Core Rule

```text
graph = routing, context, control, readiness and evidence layer
raw source = authoritative methodology, judgement and sensitive rules
```

A generated graph view may select what to read first. It must not silently
erase the authority of the source that created the meaning.

## Source Classes

A Mirai Graph implementation should classify sources before using them:

- `canonical`: approved source material or canonical graph state;
- `raw`: original source material that contains authoritative domain meaning;
- `generated`: derived context, report, dashboard or proposal;
- `evidence`: material used to support a claim or gate result;
- `draft`: working material that may be useful but is not authoritative;
- `deprecated`: material retained only for traceability.

## Authority Boundary

Canonical graph state may contain:

- stable object identifiers;
- typed relations;
- readiness state;
- evidence links;
- governance gates;
- adoption status;
- runtime policy references;
- generated view references.

Raw sources remain authoritative for:

- domain judgement;
- long-form procedures;
- sensitive runtime rules;
- safety constraints;
- legal, commercial or production-specific exceptions;
- source-writing permission.

Generated artifacts remain advisory unless an implementation explicitly accepts
them through a governance gate.

## Required Safeguards

A Hybrid Source Of Truth implementation should preserve these safeguards:

- generated context is not authorization;
- a runtime decision is not an executed action;
- feedback is not a canonical update;
- profile conformance is not semantic preservation;
- semantic preservation is not proof of effectiveness;
- effectiveness is not runtime safety.

## Graph-First Does Not Mean Graph-Only

Graph-first operation is allowed only when the graph is used as the first
navigation layer for a bounded task. It still requires fallback to raw sources
when coverage is missing, the task is sensitive, or the runtime policy requires
original source review.

Graph-only runtime should be treated as unsafe by default.

## Limited Claim

Passing a Hybrid Source Of Truth gate supports this limited claim:

```text
The Mirai Graph implementation preserves the authority boundary between graph
state, generated context and raw domain sources for the declared scope.
```

It does not prove semantic completeness, operational effectiveness or runtime
safety.
