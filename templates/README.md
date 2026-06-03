# Mirai Graph Templates

Status: alpha starter kit

These templates are small public-safe starter packages. They are intentionally
complete enough to validate, but small enough to copy into a new project and
replace with real public or private sources.

## Starters

| Template | Profile | Use when |
| --- | --- | --- |
| `software-project-starter/` | `software_specification` | Starting from features, requirements, components, tasks and risks. |
| `research-program-starter/` | `project_management` | Starting from hypotheses, evidence, milestones, review gates and publication risks. |
| `ai-employee-starter/` | `ai_employee` | Modeling an AI worker with role, skill, tool, policy, action and feedback gates. |
| `organization-governance-starter/` | `organization_governance` | Modeling mission, strategy, departments, programs, policies, controls and metrics. |

## One-Day Adoption Path

1. Choose the closest starter profile.
2. Copy the template into your project.
3. Replace synthetic object titles and summaries with your domain objects.
4. Keep private notes, secrets, raw logs and internal handoffs outside the
   public graph package.
5. Run:

```bash
npm run validate:templates
node packages/cli/validate-mirai-graph.js templates/<template-name>
```

6. Add launch records, process transitions and evidence packs only after the
   graph package shape validates.

## Boundary

Templates are starter packages, not adoption proof. Passing validation means
only that the package follows the current alpha schema/profile shape.
