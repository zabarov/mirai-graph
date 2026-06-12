# Choose A Mirai Graph Profile

Status: alpha.10 adopter workflow

## Purpose

Use this guide when you want to start a Mirai Graph package and need to choose
the first profile, starter template and validation path.

Start narrow. A useful first package should model one bounded system, not the
entire organization.

## Quick Choice

| You are modeling | Start with profile | Starter template | Validate with |
| --- | --- | --- | --- |
| Software product, feature or package | `software_specification` | `templates/software-project-starter` | `npm run validate:templates` |
| Research program or evidence workflow | `project_management` | `templates/research-program-starter` | `npm run validate:templates` |
| AI employee, agent workflow or governed AI role | `ai_employee` | `templates/ai-employee-starter` | `npm run validate:templates` |
| AI behavior constitution, role character or reflection boundary | `character_layer` | `templates/character-layer-starter` | `npm run validate:templates` |
| Organization, department, portfolio or governance system | `organization_governance` | `templates/organization-governance-starter` | `npm run validate:templates` |

## Decision Rules

Choose `software_specification` when the graph needs to manage requirements,
features, components, dependencies, implementation tasks and technical risks.

Choose `project_management` when the graph needs to coordinate goals,
milestones, tasks, decisions, risks, evidence and review gates across a bounded
initiative.

Choose `ai_employee` when the graph needs to describe an AI worker as a governed
system with role, skill, tool, policy, action, result, feedback and learning
boundaries.

Choose `character_layer` when the graph needs to describe model-independent AI
behavior governance: constitution, principles, character virtues, boundaries,
reflection protocols, violation patterns and correction loops.

Choose `organization_governance` when the graph needs to model mission,
strategy, departments, programs, policies, controls, metrics, delegated
responsibility and governance risks.

If two profiles seem valid, choose the profile that matches the first decision
you need to make:

- build or change software -> `software_specification`;
- coordinate work -> `project_management`;
- govern an AI worker -> `ai_employee`;
- govern behavior across AI roles or model backends -> `character_layer`;
- govern an organization or portfolio -> `organization_governance`.

## First-Day Workflow

```text
choose profile -> copy starter -> replace synthetic objects -> validate -> generate report -> add launch/evidence/kaizen controls
```

1. Copy the closest starter template into your project.
2. Keep the same file layout for the first iteration.
3. Replace synthetic object titles and summaries with your real public-safe or
   private project objects.
4. Keep private notes, credentials, customer data and raw logs outside public
   graph packages.
5. Run package validation.
6. Generate a Markdown report for human review.
7. Add launch records, process transitions, evidence packs and Kaizen only
   after the package shape validates.

## Commands

Profile map:

```bash
node packages/cli/mirai-graph.js choose-profile
```

Adopter plan for a role or profile:

```bash
node packages/cli/mirai-graph.js adopter plan developer
node packages/cli/mirai-graph.js adopter plan ai_employee
```

Readable report for a starter:

```bash
node packages/cli/mirai-graph.js adopter report templates/software-project-starter
```

## Boundaries

- A selected profile is a starting point, not a claim of complete governance.
- Passing validation means the package follows current alpha shape rules.
- Generated context, evidence, feedback and proposals do not authorize
  canonical updates.
- Production execution stays outside the public alpha adopter workflow.
