# Organization Governance Minimal

Status: alpha fixture

This example shows a public-safe organization-governance graph. It connects a
synthetic organization mission to strategy, portfolio, department ownership,
policy, decision right, risk control, metric, feedback and Kaizen proposal.

## Demonstrated Pattern

```text
mission -> strategy -> portfolio -> department/project
-> policy + decision right -> risk control -> metric
-> feedback -> kaizen item -> governed improvement
```

## Validate

Run from repository root:

```bash
node packages/cli/validate-growgraph.js examples/organization-governance-minimal
```

## Boundary

The example does not authorize organization changes. Feedback and Kaizen remain
review inputs until an appropriate governance gate approves a canonical update.

