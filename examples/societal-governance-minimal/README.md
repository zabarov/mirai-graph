# Societal Governance Minimal

Status: proposal fixture

This public-safe synthetic example demonstrates a non-binding
societal-governance trace. It shows how governance DNA, a participant, a
bounded AI avatar, consent, an initiative, gates, a decision trace, execution
mandate, outcome evidence and a learning proposal can be represented without
claiming legal or democratic validity.

## Demonstrated Pattern

```text
governance DNA
-> participant + consent
-> AI avatar inside delegation scope
-> initiative
-> rights/privacy/affectedness/anti-capture gates
-> decision trace
-> execution mandate
-> outcome evidence
-> learning proposal
```

## Validate

Run from repository root:

```bash
node packages/cli/validate-mirai-graph.js examples/societal-governance-minimal
```

## Boundary

The example is synthetic, non-sensitive and non-binding. Generated context,
avatar output, participation signals and outcome evidence do not authorize
decisions or update canonical graph state.
