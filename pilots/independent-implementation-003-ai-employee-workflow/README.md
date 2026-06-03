# Independent Implementation Pilot 003: AI Employee Workflow

Status: pilot fixture

## Purpose

This pilot tests whether Mirai Graph can represent an AI employee workflow as a
governed graph rather than a prompt-only agent description.

## Domain

Synthetic customer-support triage assistant.

No private company, customer, employee, runtime trace, credential or internal
project material is used.

## Research Question

Can a developer model an AI employee workflow with role, capability, policy,
approval, result, feedback and learning boundaries using only public Mirai Graph
materials?

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
node packages/cli/validate-mirai-graph.js seed pilots/independent-implementation-003-ai-employee-workflow/graph-seed.json
node packages/cli/validate-mirai-graph.js pilots/independent-implementation-003-ai-employee-workflow
node packages/cli/validate-mirai-graph.js --markdown pilots/independent-implementation-003-ai-employee-workflow
```

