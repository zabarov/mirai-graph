# Independent Implementation Pilot 004: Research Program

Status: pilot fixture

## Purpose

This pilot tests whether Mirai Graph can model a small research-program workflow
with explicit evidence, milestones, risks and publication gates.

## Domain

Synthetic research program for evaluating a graph-assisted project workflow.

No private research repository, unpublished manuscript, reviewer note, customer
data, internal handoff or runtime trace is used.

## Research Question

Can a developer model a public-safe research program as a governed Mirai Graph
package using only public profiles, examples and validators?

## Files

- `graph-seed.json`
- `mirai-graph-package.json`
- `graph/objects.json`
- `graph/relations.json`
- `gates/results.json`
- `results/profile-conformance-result.json`
- `reports/pilot-report.md`

## Commands

Run from repository root:

```bash
node packages/cli/validate-mirai-graph.js seed pilots/independent-implementation-004-research-program/graph-seed.json
node packages/cli/validate-mirai-graph.js pilots/independent-implementation-004-research-program
node packages/cli/validate-mirai-graph.js --markdown pilots/independent-implementation-004-research-program
```

