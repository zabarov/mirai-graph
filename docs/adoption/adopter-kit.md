# Mirai Graph Alpha.11 Adopter Kit

Status: alpha adoption kit

This kit is the shortest public path from "I want to try Mirai Graph" to a
validated local graph package. It is intentionally CLI-first and repository
based while npm publication is pending.

## What This Kit Gives You

- A role-to-profile map.
- Starter templates for common adoption paths.
- A validation sequence that catches schema, profile and process mistakes.
- A minimal operating loop from graph seed to evidence and feedback.
- Safety boundaries for private data, generated context and canonical updates.

It does not prove that a project is correct, complete or scientifically
validated. It proves that the adopter has a structured, reviewable starting
package that follows the current alpha.11 shape.

## Start By Role

| Role | Start with | Template | Main checks |
| --- | --- | --- | --- |
| Developer | `software_specification` | `templates/software-project-starter/` | package validation, process transition, technology feedback |
| Researcher | `project_management` | `templates/research-program-starter/` | seed validation, evidence boundaries, reproducibility notes |
| AI product team | `ai_employee` | `templates/ai-employee-starter/` | role/skill/tool/policy graph, approval gates, feedback |
| Behavior governance | `character_layer` | `templates/character-layer-starter/` | constitution, role character profiles, reflection, correction loops |
| Organization | `organization_governance` | `templates/organization-governance-starter/` | goals, departments, policies, controls, metrics |

## Local Setup

Until npm publication is complete, run commands from the repository checkout:

```bash
cd /path/to/mirai-graph
npm install
npm test
```

After npm publication, the same adopter path should be available through the
published `mirai-graph` package.

## One-Hour Adoption Path

1. Choose a role:

```bash
node packages/cli/mirai-graph.js choose-profile
```

2. Print the role plan:

```bash
node packages/cli/mirai-graph.js adopter plan developer
node packages/cli/mirai-graph.js adopter plan researcher
node packages/cli/mirai-graph.js adopter plan ai_employee
node packages/cli/mirai-graph.js adopter plan organization
```

3. Validate the closest starter:

```bash
node packages/cli/validate-mirai-graph.js templates/software-project-starter
node packages/cli/validate-mirai-graph.js templates/research-program-starter
node packages/cli/validate-mirai-graph.js templates/ai-employee-starter
node packages/cli/validate-mirai-graph.js templates/character-layer-starter
node packages/cli/validate-mirai-graph.js templates/organization-governance-starter
```

4. Generate a readable adopter report:

```bash
node packages/cli/mirai-graph.js adopter report templates/software-project-starter
```

5. Copy the starter into your own project and replace synthetic objects with
your real public-safe or private source material.

6. Run validation again in the copied package before adding runtime evidence.

## One-Day Adoption Path

Use the one-hour path, then add the executable-process layer:

```text
graph seed
-> package validation
-> context pack
-> launch record
-> process transition explanation
-> technology quality feedback
-> evidence update
-> Kaizen item
```

Recommended checks:

```bash
npm run validate:templates
npm run validate:launch-record
npm run validate:process-transition
npm run validate:technology-quality-feedback
npm run validate:instrumentation-layer
npm run validate:adopter-workflow
```

## Acceptance Checklist

An alpha.11 adopter package is ready for first internal use when:

- `mirai-graph-package.json` exists and points to graph, gates and profile.
- `graph/objects.json` has stable object ids, kinds, summaries and readiness.
- `graph/relations.json` has directed relations with valid source/target ids.
- `gates/results.json` records at least the initial validation gate.
- Private logs, credentials, customer data and internal handoffs are outside
  the public graph package.
- Generated context is treated as derived output, not canonical state.
- Evidence and feedback do not authorize canonical updates by themselves.
- Significant action paths have launch records, approval gates and technology
  quality feedback.
- Blocking findings stop release or acceptance transitions.
- Kaizen items are routed as proposals, not silent process rewrites.

## Recommended First Packages

Use these examples as references before creating your own package:

- `examples/minimal-graph/`
- `examples/implementation-control-minimal/`
- `examples/process-transition-minimal/`
- `examples/technology-quality-feedback-minimal/`
- `examples/instrumentation-layer-minimal/`
- `examples/organization-governance-minimal/`

Use these starters for new work:

- `templates/software-project-starter/`
- `templates/research-program-starter/`
- `templates/ai-employee-starter/`
- `templates/character-layer-starter/`
- `templates/organization-governance-starter/`

## Public Safety Boundary

Do not publish:

- credentials, tokens, cookies or `.env` values;
- customer-private logs or payloads;
- private handoff texts;
- internal runtime traces;
- unpublished research claims as proof;
- organization-specific policies that are not meant to be public.

Use Mirai Graph to structure the boundary:

```text
canonical graph state
-> generated context
-> runtime decision
-> evidence
-> feedback
-> proposal
-> approval
-> controlled update
```

Only the controlled update changes canonical state.

## What To Do After The First Package Validates

1. Add a launch record for the first real work cycle.
2. Run a process-transition explanation before implementation.
3. Capture evidence and technology quality feedback after the work.
4. Add Kaizen findings for reusable process improvements.
5. Keep a short pilot report that separates observed evidence from claims.

The next maturity step is not more theory; it is a small, repeatable pilot with
clear evidence, limits and replayable validation commands.
