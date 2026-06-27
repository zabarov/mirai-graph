# Getting Started With Mirai Graph

Status: 1.0 release-candidate adoption guide

## Goal

This guide helps a team create a first Mirai Graph package for a project,
product, organization or human-AI workflow.

For the fastest path from an existing project, use
[Connect A Project In 15 Minutes](connect-project-15-minutes.md). For a
developer-focused explanation of what problem Mirai Graph solves, start with
[Mirai Graph For Developers](for-developers.md). For a shorter role-oriented
entry point, start with the [1.0 RC Adopter Kit](adopter-kit.md).

## NPM-First Quick Start

From the project you want to connect:

```bash
npm install -D mirai-graph
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
```

Release-candidate note: `mirai-graph@1.0.0-rc.6` is not published on npm yet.
Until npm publication is complete, use the repository checkout path and run the
same commands through `node packages/cli/mirai-graph.js`.

Use `detect` first when you are unsure which profile to use. `detect` is
read-only. `bootstrap --mode suggest` creates proposal/evidence only. `init`
creates the starter package after you choose a profile.

## Step 1: Choose The System Boundary

Define what the graph will manage.

Examples:

- one product;
- one software project;
- one research program;
- one organizational process;
- one AI-assisted workflow.

Avoid starting with the whole organization unless the immediate scope is clear.

Then choose the closest profile:

- software project or package -> `software_specification`;
- research or cross-functional work -> `project_management`;
- governed AI worker -> `ai_employee`;
- organization, department or portfolio governance -> `organization_governance`.

Use [Choose A Mirai Graph Profile](choose-profile.md) for the full profile and
starter-template map.

## Step 2: Create A Graph Seed

Start with a small seed:

- 3-10 objects;
- the most important relations;
- evidence boundaries;
- one target task;
- one readiness policy.

Do not try to model everything at once.

## Step 3: Create Package Files

Recommended minimal structure:

```text
mirai-graph-package.json
graph/
  objects.json
  relations.json
gates/
  results.json
```

Use `examples/minimal-graph/` as a minimal reference or start from one of the
starter templates in `templates/`.

## Step 4: Define Objects

Create objects for things that need stable identity:

- goals;
- requirements;
- features;
- decisions;
- risks;
- tasks;
- components;
- evidence;
- governance gates.

Each object should have:

- `id`;
- `kind`;
- `title`;
- `summary`;
- `readiness`;
- `evidence`;
- `profile`.

## Step 5: Define Relations

Add relations only when the connection changes understanding, execution or
governance.

Common relation types:

- `depends_on`;
- `supports`;
- `blocks`;
- `implements`;
- `evidences`;
- `governs`;
- `generates`;
- `related_to`.

## Step 6: Validate The Package

Run:

```bash
npx mirai-graph validate <package-dir>
```

Example:

```bash
node packages/cli/validate-mirai-graph.js examples/minimal-graph
```

For a role-oriented starter workflow, run:

```bash
npx mirai-graph choose-profile
npx mirai-graph adopter plan developer
npx mirai-graph adopter report templates/software-project-starter
```

## Step 7: Generate A Context Pack

For the first iteration, write a simple manual context pack:

- task;
- included objects;
- included relations;
- evidence;
- assumptions;
- omissions;
- limitations.

Later, automate generation from the canonical graph.

## Step 8: Review Governance

Before using the graph for decisions or action, check:

- What is draft?
- What is accepted?
- What is blocked?
- What evidence is missing?
- What requires human approval?
- What cannot be published?

## Step 9: Grow Iteratively

Mirai Graph works best as an iterative model:

```text
seed -> embryo -> reviewed graph -> context packs -> task results -> graph updates
```

Keep each growth step reviewable.

## Common Mistakes

- Modeling too much too early.
- Treating generated context as canonical state.
- Adding relations without evidence or direction.
- Publishing private material in examples.
- Claiming validation before tests exist.
- Skipping governance gates for action-capable workflows.
