# End-To-End GrowGraph Control Loop

Status: alpha tutorial

## Purpose

This tutorial shows the public alpha control loop:

```text
seed -> graph -> context -> launch -> transition -> evidence -> kaizen
```

It uses existing public-safe examples. It does not require private project data
and does not grant automatic permission to change canonical graph state.

## 1. Start With A Seed

A graph seed defines the first bounded system shape before a full graph exists.

Run:

```bash
node packages/cli/validate-growgraph.js seed examples/graph-seed-minimal/graph-seed.json
node packages/cli/seed-preview.js examples/graph-seed-minimal/graph-seed.json
```

Read:

- `standard/graph-seed.md`
- `examples/graph-seed-minimal/README.md`

## 2. Validate A Graph Package

A package stores graph objects, relations and gate results.

Run:

```bash
node packages/cli/validate-growgraph.js examples/minimal-graph
```

Read:

- `standard/object-model.md`
- `standard/relation-model.md`
- `standard/evidence-provenance.md`

## 3. Generate Or Inspect Task Context

Context packs select task-relevant graph material. They are generated context,
not canonical state.

Run:

```bash
node packages/cli/context-pack.js benchmarks/synthetic-context-reduction-v0 --task-id task.notify_after_approval
node packages/cli/validate-growgraph.js context-pack benchmarks/synthetic-context-reduction-v0 benchmarks/synthetic-context-reduction-v0/results/context-pack.json
```

Read:

- `standard/context-pack-generation.md`
- `benchmarks/synthetic-context-reduction-v0/README.md`

## 4. Prepare A Launch Record

A launch record defines a bounded work batch, required gates, allowed scope and
evidence expectations. It is not proof that the work has been executed.

Run:

```bash
node packages/cli/validate-growgraph.js examples/launch-record-minimal
node packages/cli/validate-growgraph.js launch-record examples/launch-record-minimal/results/launch-record.json
```

Read:

- `standard/launch-record.md`
- `examples/launch-record-minimal/README.md`

## 5. Validate A Process Transition

Process transitions move through executable state-machine states. Human stages
and documentation can explain the movement, but the transition request must
pass validator checks.

Run:

```bash
node packages/cli/validate-growgraph.js process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
node packages/cli/validate-growgraph.js process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request-skip-kaizen.json
```

Negative fixtures intentionally fail:

```bash
npm run test:process-transition-negative
```

Read:

- `standard/work-state-machine.md`
- `standard/process-control-contract.md`
- `examples/process-transition-minimal/README.md`

## 6. Record Evidence

Evidence links claims to sources, gates, validation results and limitations. It
does not approve canonical updates by itself.

Run:

```bash
npm run validate:implementation-control
npm run validate:process-control
```

Read:

- `standard/evidence-provenance.md`
- `standard/implementation-control.md`
- `examples/process-control-contract-minimal/README.md`

## 7. Close With Kaizen

Significant work should end with a Kaizen review or an explicit
`no_reusable_lessons` reason. Kaizen findings become classified improvement
inputs, not automatic rewrites.

Run:

```bash
npm run validate:implementation-control-cycles
```

Read:

- `standard/implementation-control-cycles.md`
- `examples/implementation-control-cycles/README.md`

## Full Smoke Check

Run the current alpha test suite:

```bash
npm test
```

Generate the playground report for this loop:

```bash
npm run playground:demo
```

For release readiness:

```bash
npm run release:check
```

## Boundaries

- Generated context is not canonical state.
- Evidence is not approval.
- A proposal is not a canonical update.
- `ready_to_execute` is not execution.
- Synthetic benchmarks are method demonstrations, not broad scientific proof.
