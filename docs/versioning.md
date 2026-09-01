# Mirai Versioning

Status: stable 1.4 compatibility contract

Mirai uses independent version dimensions. A matching number in two dimensions
does not imply that their lifecycle or compatibility boundary is the same.

| Dimension | Current baseline | Meaning |
|---|---:|---|
| npm/product release | `1.4.1` | Public package, CLI and repository release |
| `graph.json` manifest | `2.0.0` | Workspace/package manifest shape |
| Project Technology activation | `1.0.0` | `mirai.project_technology` extension contract |
| Executable Technology | `1.0.0` | Declarative technology and Course Pack contract |

Mirai 2.0 changes the product boundary by adding Mirai Program and Mirai
Runtime. It does not automatically invalidate a `graph.json` manifest whose
schema version is already `2.0.0`.

Compatibility rules:

- a Mirai 2.x validator must continue to read valid 1.4 graph packages;
- migration is preview-only unless an explicit apply operation is approved;
- ambiguous executable behavior is reported as a proposal or blocker, never
  invented by migration;
- old schema identifiers remain recognized through the 2.x line;
- removal of `mirai-graph` package or CLI aliases is not allowed before 3.0.

Planned Mirai 2.0 contract versions:

- Mirai Program: `1.0.0`;
- Runtime API: `1.0.0`;
- capability, checkpoint, receipt, episode and conformance contracts: `1.0.0`.

These contracts use a new schema namespace without rewriting historical schema
identifiers.
