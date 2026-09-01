# Mirai 2 API Reference

Status: `2.0.0-alpha.3`; API is not frozen until the release candidate

## Package Exports

The primary package is `@zabarov/mirai`. It provides CommonJS and ESM exports:

| Export | Purpose |
| --- | --- |
| `@zabarov/mirai/core` | Canonical JSON and digest helpers. |
| `@zabarov/mirai/program` | YAML/JSON compilation, validation, planning and migration. |
| `@zabarov/mirai/runtime` | Pure and governed execution, recovery, replay and evidence. |
| `@zabarov/mirai/adapters` | Reference adapter interfaces and implementations. |
| `@zabarov/mirai/conformance` | Portable corpus execution and result comparison. |

The primary CLI is `mirai`. The `mirai-graph` and `mirai_graph` binaries remain
compatibility aliases throughout 2.x.

## Program API

- `parseProgramSource(source, filename)` parses authoring YAML without running it.
- `compileProgramSource(source, filename)` returns validated deterministic JSON IR.
- `compileProgramFile(filename)` compiles YAML or verifies compiled JSON IR.
- `validateProgram(value, options)` performs schema and semantic checks.
- `simulatePlan(program)` returns a no-effect control-flow plan.
- `migrateTechnology(technology, bindings)` produces a proposal-only migration result.

Compilation is deterministic. Runtime accepts compiled JSON IR only and never
executes YAML directly.

## Runtime API

- `executePure(program, input, options)` executes an effect-free Program.
- `replayPure(episode, program, options)` reproduces a pure episode.
- `startGovernedRun(program, input, options)` creates and executes a durable run.
- `resumeGovernedRun(runId, options)` re-enters a run from verified state.
- `reconcileGovernedRun(runId, options)` resolves executed or uncertain effects.
- `cancelGovernedRun(runId, options)` records terminal cancellation.
- `inspectGovernedRun(runId, options)` returns a redacted operational view.
- `replayGovernedEpisode(episode, program, options)` replays effect stubs only.
- `exportSanitizedEvidence(runId, outputDirectory, options)` exports public-safe evidence.

`ReferenceCapabilityProvider`, `EffectCoordinator` and `RunStore` are reference
implementation surfaces. They are not authority by themselves: the host owns
policy, approval secrets, adapter allowlists and sandbox selection.

The CLI accepts either an episode file or a governed `run-id` for replay. With
a run id it resolves the host-local episode through `RunStore`; callers do not
depend on the internal hashed directory layout.

## Contract Versions

Program, Runtime API, capabilities, approvals, receipts, checkpoints, episodes
and conformance artifacts use contract version `1.0.0`. Product version and
`graph.json` manifest schema version are independent dimensions.

## Compatibility Boundary

The 1.4 graph/package validators remain available through the root package and
legacy CLI aliases. Existing graphs without `mirai.program` remain valid.
Generated context, a Program, episode or evidence file cannot authorize a
canonical graph update.
