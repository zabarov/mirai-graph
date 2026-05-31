# Route Explanation

Status: alpha standard section

## Purpose

A route explanation records why a graph-managed federation selected a primary
owner, companion capabilities, gates and fallbacks for a request.

It is meant to make routing auditable before any runtime action starts.

## Required Meaning

A route explanation should include:

- request summary;
- primary owner;
- companion capabilities;
- rejected nearby candidates with reasons;
- required gates;
- required raw-source fallbacks;
- route execution evidence reference;
- confidence and known gaps;
- runtime preflight reference when the route is high-risk.

## Boundary

Route explanation is not authorization.

```text
explained route != permission to execute
explained route != permission to rewrite canonical sources
```

High-risk routes should link to a runtime preflight result before execution.
