# Connect A Project In 15 Minutes

Status: 1.0 release-candidate tutorial

This tutorial starts from an existing project and creates a first validated
Mirai Graph package. It is intentionally small: the goal is a reviewable
starter graph, not a complete model of the project.

If you want the developer-facing rationale first, read
[Mirai Graph For Developers](for-developers.md).

## 1. Install

From the project you want to connect:

```bash
npm install -D mirai-graph
```

Release-candidate note: `mirai-graph@1.0.0-rc.4` is not published on npm yet.
Until npm publication is complete, use a repository checkout and run the same
commands through `node packages/cli/mirai-graph.js`.

You can also run without saving the dependency:

```bash
npx mirai-graph detect . --markdown
```

## 2. Detect The Project

Run read-only detection:

```bash
npx mirai-graph detect . --markdown
```

Detection reports whether a Mirai Graph package already exists, which profile
is recommended, which artifacts are missing and what the next safe action is.
Detection does not write files.

## 3. Generate A Bootstrap Proposal

Create a proposal without changing canonical graph files:

```bash
npx mirai-graph bootstrap . --mode suggest --markdown
```

The proposal is written to:

```text
mirai-graph/bootstrap-proposal/
```

It keeps `canonical_write_allowed=false`.

## 4. Initialize The Starter Graph

After reviewing the recommendation, create a starter package:

```bash
npx mirai-graph init . --profile software_specification
```

Use another profile when detection recommends it:

```bash
npx mirai-graph init . --profile project_management
npx mirai-graph init . --profile ai_employee
npx mirai-graph init . --profile character_layer
npx mirai-graph init . --profile organization_governance
```

`init` creates:

```text
mirai-graph-package.json
graph/objects.json
graph/relations.json
gates/results.json
```

It refuses to overwrite existing graph files unless `--force` is passed.

## 5. Validate

Run:

```bash
npx mirai-graph validate .
```

For a human-readable report:

```bash
npx mirai-graph report validation .
```

## 6. Add CI

Copy the GitHub Action starter from:

```text
.github/workflows/mirai-graph-validate.yml
```

Use this command in CI:

```bash
npx mirai-graph validate .
```

Adjust `.` if your package root is somewhere else.

## Boundaries

- A starter graph is not proof that the project is correct.
- Generated proposals do not update canonical graph state.
- Evidence and feedback do not authorize production changes.
- Private data, credentials and customer logs should stay outside public graph
  packages.
