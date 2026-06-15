# Routing Fixtures

Status: 1.0 release-candidate standard section

## Purpose

Routing fixtures test whether a graph-managed router selects the expected
owner, companions, gates and fallback behavior for known scenarios.

They are especially useful for negative routing cases where a nearby generic
owner would be unsafe.

## Negative Fixtures

Fixtures should cover routes that must not collapse into a simpler route:

- production or live infrastructure;
- customer-visible writes;
- credentials, secrets or private data;
- legal, commercial or scientific claims;
- owner-source rewrites;
- platform architecture or migration decisions.

## Forbidden Route Shapes

Use `forbidden_route_shapes` when a skill can be a valid primary owner but
must not be selected alone.

Example:

```json
{
  "primary_skill": "generic_development",
  "without_companions": ["operations", "qa"],
  "reason": "Production deployment requires runtime and acceptance gates."
}
```

## Boundary

Fixture evidence may support learning proposals. It must not directly rewrite
source-of-truth files.

## Evidence

A fixture run should preserve one evidence pack per fixture:

- parsed route result;
- execution evidence with command, working directory, exit code and output
  hashes;
- stdout/stderr references;
- route explanation reference for high-risk routes.

High-risk fixtures should fail when the route explanation is missing.
