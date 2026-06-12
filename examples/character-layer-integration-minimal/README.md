# Character Layer Integration Minimal

This example shows how Character Layer composes with other Mirai Graph layers
without merging their profile vocabularies into one package.

It models references between:

- Character Layer starter package;
- AI employee and role;
- process control contract;
- launch record;
- technology quality feedback;
- runtime context and reflection protocol.

Validate:

```bash
node packages/cli/validate-mirai-graph.js character-layer-integration examples/character-layer-integration-minimal/results/character-layer-integration.json
```

## Boundary

The integration artifact is a composition contract. It does not grant runtime
permission, execute tools, authorize external action or update canonical graph
state.
