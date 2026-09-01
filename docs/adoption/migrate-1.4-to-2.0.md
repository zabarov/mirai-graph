# Migrate Mirai Graph 1.4 To Mirai 2.0

Status: `2.0.0-alpha.1` migration preview

## Compatibility

Existing 1.4 graph packages remain valid without a `mirai.program` extension.
The `mirai-graph` package and CLI aliases remain supported throughout 2.x.
Migration adds an optional executable Program; it does not convert raw source
documents into graph content or change canonical graph state automatically.

## Dry-Run First

```bash
mirai migrate path/to/technology.json --from 1.4 --dry-run
```

Without explicit operation bindings the result is blocked. This is expected:
the migrator must not guess which adapter, operation, effect or capability an
old technology step represents.

Provide reviewed bindings for an unambiguous synthetic or project-local case:

```bash
mirai migrate path/to/technology.json --from 1.4 --dry-run --bindings path/to/bindings.json
```

The result contains a candidate Program with
`canonical_write_allowed=false`. Alpha.1 has no migration apply command.

## Manual Review Questions

- Does each operation map to one explicit adapter operation?
- Is every declared effect allowed by the Program policy?
- Does every non-pure effect name a capability request?
- Are dependencies represented without inventing branches?
- Is the selected scenario complete for its stated outcome?
- Are output types and error routes explicit?
- Does the proposal preserve Hybrid SOT and owner authority?

Ambiguous control flow, missing bindings or multiple scenarios require separate
owner-reviewed Program proposals.
