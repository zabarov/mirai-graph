# GrowGraph Playground

Status: alpha runnable index

This directory is a playground index for public-safe GrowGraph demos. The
current alpha playground is CLI-based: runnable examples live in `examples/`,
`benchmarks/` and `pilots/`.

## Quick Runs

Validate a minimal graph package:

```bash
npm run validate:minimal
```

Preview a graph seed:

```bash
npm run seed:preview
```

Generate a synthetic context pack:

```bash
npm run context:generate
```

Generate the end-to-end playground report:

```bash
npm run playground:demo
```

Validate implementation-control and process-control examples:

```bash
npm run validate:implementation-control
npm run validate:implementation-control-cycles
npm run validate:launch-record
npm run validate:process-transition
npm run validate:process-control
```

Run negative fixtures:

```bash
npm run test:negative
npm run test:process-transition-negative
```

Run the full alpha suite:

```bash
npm test
```

## Demo Paths

- `examples/minimal-graph/`
- `examples/graph-seed-minimal/`
- `examples/implementation-control-minimal/`
- `examples/implementation-control-cycles/`
- `examples/launch-record-minimal/`
- `examples/process-transition-minimal/`
- `examples/process-control-contract-minimal/`
- `benchmarks/synthetic-context-reduction-v0/`
- `playground/demo-report.md`

## Future Work

A hosted or interactive playground can be added later. Until then, this index
keeps the public README honest: GrowGraph has runnable demos, but not yet a
separate interactive application.
