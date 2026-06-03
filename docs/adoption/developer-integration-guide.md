# Mirai Graph Developer Integration Guide

Status: alpha developer guide

## Purpose

This guide shows how to use Mirai Graph validation in a developer workflow or CI
pipeline.

Mirai Graph tooling is a reference implementation. The standard remains the
source of the model; the CLI helps teams check public-safe graph packages,
profiles, context packs and process-control artifacts.

## Install

For the current alpha, run commands from the repository root:

```bash
npm install
```

## Validate A Package

JSON output is the default:

```bash
node packages/cli/validate-mirai-graph.js examples/minimal-graph
```

Human-readable Markdown output:

```bash
node packages/cli/validate-mirai-graph.js --markdown examples/minimal-graph
```

## Validate Process Control

Use process-transition validation when work moves through an executable state
machine:

```bash
node packages/cli/validate-mirai-graph.js process-transition \
  examples/process-transition-minimal/state-machine.json \
  examples/process-transition-minimal/transition-request.json
```

Use process-control contract validation when a project binds cycles, state
machine, launch policy, evidence, recovery and Kaizen policy:

```bash
node packages/cli/validate-mirai-graph.js process-control-contract \
  examples/process-control-contract-minimal/results/process-control-contract.json
```

## CI Example

Minimal GitHub Actions step:

```yaml
- name: Validate Mirai Graph examples
  run: |
    npm ci
    npm run release:check
```

Targeted package check:

```yaml
- name: Validate Mirai Graph package
  run: |
    node packages/cli/validate-mirai-graph.js path/to/package
```

Markdown report artifact:

```yaml
- name: Generate Mirai Graph validation report
  run: |
    node packages/cli/validate-mirai-graph.js --markdown path/to/package > mirai-graph-report.md
```

## Exit Codes

- `0`: validation passed.
- `1`: validation failed or an input file could not be read.
- `2`: command usage error.

## Boundaries

- A passing validation report is evidence for the selected check only.
- Generated context is not canonical graph state.
- Evidence and proposals do not authorize canonical updates.
- Readiness states do not imply execution or release.
