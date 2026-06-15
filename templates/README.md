# Mirai Graph Templates

Status: 1.0 release-candidate starter kit

These templates are small public-safe starter packages. They are intentionally
complete enough to validate, but small enough to copy into a new project and
replace with real public or private sources.

For the full role-oriented starter path, use the
[1.0 RC Adopter Kit](../docs/adoption/adopter-kit.md).

For self-service onboarding in a project, prefer:

```bash
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
```

`init` copies only starter graph package files. It does not overwrite project
README files and refuses to replace existing graph files unless `--force` is
passed.

## Starters

| Template | Profile | Use when |
| --- | --- | --- |
| `software-project-starter/` | `software_specification` | Starting from features, requirements, components, tasks and risks. |
| `research-program-starter/` | `project_management` | Starting from hypotheses, evidence, milestones, review gates and publication risks. |
| `ai-employee-starter/` | `ai_employee` | Modeling an AI worker with role, skill, tool, policy, action and feedback gates. |
| `character-layer-starter/` | `character_layer` | Reusing behavior constitution, role character profiles, reflection and correction boundaries. |
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

## Adopter Workflow Commands

List the role/profile/starter map:

```bash
node packages/cli/mirai-graph.js choose-profile
```

Print a plan for a role or profile:

```bash
node packages/cli/mirai-graph.js adopter plan organization
node packages/cli/mirai-graph.js adopter plan ai_employee
```

Generate a readable report for a starter:

```bash
node packages/cli/mirai-graph.js adopter report templates/organization-governance-starter
```

## Boundary

Templates are starter packages, not adoption proof. Passing validation means
only that the package follows the current release-candidate schema/profile
shape.
