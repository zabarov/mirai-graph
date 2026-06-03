# Independent Implementation Pilot 002: Software Specification

Status: pilot fixture

## Purpose

This pilot tests whether a valid Mirai Graph package can be created for a small
software specification workflow using only the public repository materials.

## Domain

Synthetic team notification API workflow.

No private company, customer, employee or internal project material is used.

## Research Question

Can a developer create a valid Level 1 Mirai Graph package for a small software
specification using only public Mirai Graph docs, schemas and examples?

## Files

- `graph-seed.json`
- `mirai-graph-package.json`
- `graph/objects.json`
- `graph/relations.json`
- `gates/results.json`
- `results/`
- `reports/pilot-report.md`

## Commands

Run from repository root:

```bash
node packages/cli/validate-mirai-graph.js seed pilots/independent-implementation-002-software-specification/graph-seed.json
node packages/cli/validate-mirai-graph.js pilots/independent-implementation-002-software-specification
node packages/cli/readiness-score.js pilots/independent-implementation-002-software-specification --target-mode pilot
node packages/cli/context-pack.js pilots/independent-implementation-002-software-specification --task-id task.implement_retry_policy
```
