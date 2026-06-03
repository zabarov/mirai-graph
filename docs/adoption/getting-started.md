# Getting Started With Mirai Graph

Status: initial adoption guide

## Goal

This guide helps a team create a first Mirai Graph package for a project,
product, organization or human-AI workflow.

## Step 1: Choose The System Boundary

Define what the graph will manage.

Examples:

- one product;
- one software project;
- one research program;
- one organizational process;
- one AI-assisted workflow.

Avoid starting with the whole organization unless the immediate scope is clear.

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

Use `examples/minimal-graph/` as a starting point.

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
node packages/cli/validate-mirai-graph.js <package-dir>
```

Example:

```bash
node packages/cli/validate-mirai-graph.js examples/minimal-graph
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
