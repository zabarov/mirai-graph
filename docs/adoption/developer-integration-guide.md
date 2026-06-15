# Mirai Graph Developer Integration Guide

Status: 1.0 release-candidate developer guide

## Purpose

This guide shows how to use Mirai Graph validation in a developer workflow or
CI pipeline.

Mirai Graph tooling is a reference implementation. The standard remains the
source of the model; the CLI helps teams check graph packages, profiles,
context packs and process-control artifacts.

## Install In A Project

Use the npm package in the project you want to connect:

```bash
npm install -D mirai-graph
```

Detect the project and create a proposal before adding canonical graph files:

```bash
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
```

After reviewing the proposal, initialize and validate the starter graph:

```bash
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
npx mirai-graph report validation .
```

Use another profile when appropriate:

```bash
npx mirai-graph init . --profile project_management
npx mirai-graph init . --profile ai_employee
npx mirai-graph init . --profile character_layer
npx mirai-graph init . --profile organization_governance
```

## Contributor Checkout

Use repository checkout commands when changing Mirai Graph itself:

```bash
cd /path/to/mirai-graph
npm install
npm test
```

Direct script calls are mainly for maintainers and validators:

```bash
node packages/cli/validate-mirai-graph.js examples/minimal-graph
node packages/cli/validate-mirai-graph.js --markdown examples/minimal-graph
```

## CI Example

Minimal GitHub Actions step for an adopter project:

```yaml
- name: Validate Mirai Graph package
  run: npx mirai-graph validate .
```

Markdown report artifact:

```yaml
- name: Generate Mirai Graph validation report
  run: npx mirai-graph report validation . > mirai-graph-report.md
```

Repository maintainers can use the full release-candidate suite:

```yaml
- name: Validate Mirai Graph repository
  run: |
    npm ci
    npm run release:check
```

## Process-Control Checks

Use process-transition validation when work moves through an executable state
machine:

```bash
npx mirai-graph explain process-transition \
  examples/process-transition-minimal/state-machine.json \
  examples/process-transition-minimal/transition-request.json
```

Use process-control contract validation from a repository checkout when a
project binds cycles, state machine, launch policy, evidence, recovery and
Kaizen policy:

```bash
node packages/cli/validate-mirai-graph.js process-control-contract \
  examples/process-control-contract-minimal/results/process-control-contract.json
```

## Exit Codes

- `0`: validation passed.
- `1`: validation failed or an input file could not be read.
- `2`: command usage error.

## Boundaries

- `detect` is read-only.
- `bootstrap --mode suggest` writes proposal/evidence only.
- `init` creates starter graph files and refuses to overwrite by default.
- A passing validation report is evidence for the selected check only.
- Generated context is not canonical graph state.
- Evidence and proposals do not authorize canonical updates.
- Readiness states do not imply execution or release.
