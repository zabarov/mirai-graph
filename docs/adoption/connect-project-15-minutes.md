# Connect A Project In 15 Minutes

Status: Mirai 2.1 development tutorial

This tutorial starts from an existing project and creates a first validated
Mirai Graph package. It is intentionally small: the goal is a reviewable
starter graph, not a complete model of the project.

If you want the developer-facing rationale first, read
[Mirai Graph For Developers](for-developers.md).

## 1. Install

From the project you want to connect:

```bash
npm install -D @zabarov/mirai
```

During 2.1 development, use the repository checkout when the requested build
is not yet published. The `mirai-graph` binary remains a 2.x compatibility
alias, but new documentation uses `mirai`.

You can also run without saving the dependency:

```bash
npx mirai project detect . --markdown
```

## 2. Detect The Project

Run read-only detection:

```bash
npx mirai project detect . --markdown
```

Detection reports whether a Mirai Graph package already exists, which profile
is recommended, which artifacts are missing and what the next safe action is.
Detection does not write files.

## 3. Generate A Bootstrap Proposal

Create a proposal without changing canonical graph files:

```bash
npx mirai bootstrap . --mode suggest --profile software_specification
```

The proposal is written to:

```text
.mirai/proposals/bootstrap-proposal.json
```

It keeps `canonical_write_allowed=false`.

## 4. Initialize The Starter Graph

After reviewing the recommendation, create a starter package:

```bash
npx mirai project init . --profile software_specification
```

Use another profile when detection recommends it:

```bash
npx mirai project init . --profile project_management
npx mirai project init . --profile ai_employee
npx mirai project init . --profile character_layer
npx mirai project init . --profile organization_governance
```

`init` creates:

```text
mirai/manifest.yaml
mirai/manifest.lock.json
mirai/START.md
mirai/graph/objects.json
mirai/graph/relations.json
graph.json  # generated 2.x compatibility facade
```

It refuses to overwrite an existing capsule. Canonical adoption remains an
explicit action after proposal review.

## 5. Validate

Run:

```bash
npx mirai project validate .
```

For a human-readable report:

```bash
npx mirai project inspect . --for-agent --task "review project readiness"
```

## 6. Add CI

Copy the GitHub Action starter from:

```text
.github/workflows/mirai-graph-validate.yml
```

Use this command in CI:

```bash
npx mirai project validate .
```

Adjust `.` if your package root is somewhere else.

## Boundaries

- A Project Capsule is not proof that the project is correct.
- Generated proposals do not update canonical graph state.
- Evidence and feedback do not authorize production changes.
- Private data, credentials and customer logs should stay outside public graph
  packages.
