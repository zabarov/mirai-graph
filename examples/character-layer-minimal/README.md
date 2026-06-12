# Minimal Character Layer Example

This example is a synthetic public-safe package for the
`character_layer` profile.

It shows how a character constitution can define principles, promote character
virtues, set character boundaries, support a role character profile, use a
reflection protocol, exercise a fixture, describe a violation pattern and route
correction through a reviewed update loop.

The example is structural conformance evidence for the profile vocabulary. It
is not runtime evidence and does not authorize external actions or canonical
graph writes.

## Files

- `mirai-graph-package.json`: package manifest using `profile:
  "character_layer"`;
- `graph/objects.json`: synthetic profile objects;
- `graph/relations.json`: relations among the synthetic objects;
- `gates/results.json`: public-safety and review-boundary gate results.

## Validate

From the repository root:

```bash
node packages/cli/validate-mirai-graph.js examples/character-layer-minimal
```
