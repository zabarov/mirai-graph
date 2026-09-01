# Mirai 2.0 Architecture Decisions

Status: accepted for the 2.0 development track

## Decision

Mirai 2.0 evolves Mirai Graph from a declarative governance standard into a
governed executable environment. It does so by adding Program and Runtime
components, not by storing all project knowledge in a graph or replacing raw
owner sources.

## Component Boundaries

- **Mirai Graph Core**: meaning, navigation, ownership, policies, provenance,
  readiness and evidence references.
- **Mirai Program**: typed, immutable process IR with bounded control flow.
- **Mirai Runtime**: deterministic scheduling, durable state and effect
  coordination.
- **Mirai Adapters**: host implementations behind capabilities.
- **Mirai Episodes**: audit, replay and outcome evidence.
- **Mirai Federation**: routing and composition across owners and programs.

## Accepted Decisions

1. Hybrid SOT remains mandatory. Graph-only runtime is invalid.
2. YAML is an authoring format; JSON IR is the only runtime input.
3. Expressions use a closed AST and never `eval` source strings.
4. Every loop, retry, await, parallel branch and run has a budget.
5. Programs request effects; host policy issues opaque capabilities.
6. Canonical graph, Program, runtime state, external state, evidence and
   proposals are distinct stores with distinct authorities.
7. The runtime provides receipts, reconciliation and compensation rather than
   claiming exactly-once external effects.
8. Learning is proposal-only and cannot self-modify an active program.
9. The TypeScript runtime and independent Python checker must agree on the
   public conformance corpus before stable release.
10. Stable 2.0 requires controlled Federation, Larena and AI Employee pilots.

## Rejected For 2.0

- arbitrary JavaScript/Python embedded in programs;
- unbounded `while` or arbitrary `race`;
- capabilities minted by graph or program content;
- automatic canonical updates from episodes or feedback;
- required network, production or secret-changing adapters;
- broad quality or model-independence claims without controlled evidence.

## Version Dimensions

Product/package `2.0.0-*`, graph manifest `2.0.0`, Program `1.0.0`, Runtime API
`1.0.0`, capabilities, receipts, checkpoints, episodes and conformance
contracts all evolve independently. Compatibility is determined per contract,
not by comparing a single number.
