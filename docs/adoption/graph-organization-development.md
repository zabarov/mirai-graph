# Graph Organization Development Preview

Status: Mirai 2.3 local development preview. Not published or production-ready.
Package metadata stays on its 2.2 development baseline until release review.

## What it does

Several specialists can use the same source references in different contexts.
For example, one requirement belongs to both a requirements group and a safety
group. The file is not copied. Membership selects a view; it does not grant
permission to read private sources or change a process.

The preview provides thirteen pure operations, deterministic overlapping cluster
proposals, host-injected inference, and a bounded durable task SDK. The task SDK
can call existing pure Mirai Programs or a host-supplied AI provider. Tests use
recorded/mock providers; no network model is enabled automatically.

## Run from this checkout

```bash
npm run build
node packages/cli/mirai.js stdlib list
node packages/cli/mirai.js stdlib describe graph.query
node packages/cli/mirai.js graph query examples/mirai-graph-operations-minimal/query.json
node packages/cli/mirai.js cluster propose examples/mirai-graph-operations-minimal/cluster.json
npm run test:mirai-2.3
npm run pilot:graph-organization
npm run pilot:graph-computed
```

The CLI prints proposals to stdout. It does not modify the canonical project.
Legacy `component validate` remains available. `component describe` and
`component resolve` accept an argument JSON file and return values, not effects.

## Program binding

Program 1.0 uses an explicitly injected `createStandardPureAdapters(catalogDigest)`
registry. Its old default adapter behavior and digest computation remain intact.
The development Program 1.1 contract requires:

```json
{
  "contract_version": "1.1.0",
  "operation_catalog": {
    "id": "mirai.stdlib",
    "contract_version": "1.0.0",
    "digest": "<digest returned by stdlib list>"
  }
}
```

This fragment belongs inside a complete Program. Use `call` with adapter
`mirai_stdlib` and an operation such as `graph.query`. Unknown catalogs,
operations, argument names and invalid literal arguments fail compilation.
Dynamic argument validation happens before the operation executes. Native
bindings cannot be silently replaced by a custom same-named pure callback.
Catalog content changes require explicit recompilation of Program 1.1 artifacts.

## Task SDK boundaries

`@zabarov/mirai/tasks` exports `createTaskPolicy`, `prepareTaskPlan`,
`programTaskReceiver`, `TaskHost` and `replayTasks`.

1. Host authorization establishes allowed participants, sources and budgets.
2. A plan binds a fixed set of tasks to the graph, policy and receiver digests.
3. `TaskHost.create` reserves durable state; `runReady` runs ready tasks.
4. Returning output and evidence records completion, not acceptance.
5. `accept` requires a host-authorized reviewer and the exact result digest.
6. `replayRecord` and `replayTasks` inspect recorded results without dispatch.

Acceptance callbacks must verify real evidence and authenticated reviewer
identity. A callback that always returns true is suitable only for a synthetic
test. The graph cannot install callbacks, grant itself authority or accept its
own work. A task's context is narrowed through its entire parent chain; dependent
result sharing must preserve object, source and relation access boundaries.

## Governed Program Calls

`createTaskRuntimeAdapters(registry)` installs a fixed host registry into
`startGovernedRun` / `resumeGovernedRun`. A Program 1.1 `call` selects the
`mirai_tasks` adapter and `submit`, `dispatch`, `inference`, `inspect`, `collect`,
`accept`, `cancel` or `reconcile`. These are effects, never pure operations.
Arguments bind `registry_digest`, `plan_digest` and, where applicable, `task_id`.
Acceptance also binds `reviewer`, `result_digest` and `verdict`.

No default capability rule grants these calls. Mutations and inference require
an exact signed approval and `apply: true`, even if a custom rule marks approval
optional. Acceptance requires the designated independent reviewer, not merely
the worker's output. A blocked review can resume with that approval without
executing verified work again. Each Runtime registry contains one fixed plan
to preserve a single shared budget root. New parent runs get distinct provider
idempotency keys; restart of the same run reuses recorded outcomes.

See the [bridge contract](../architecture/mirai-task-runtime-bridge.md) and
`test/tasks/runtime-bridge.test.cjs` for executable host setup and negative tests.
The [task Runtime example](../../examples/mirai-task-runtime-minimal/README.md)
provides `task validate`, read-only `task inspect` and explicit
`--task-registry` loading for the existing `run` and `resume` commands. Registry
files support pure Programs and recorded AI cases, not arbitrary executable
configuration or live model providers.
The standalone task SDK still requires an authenticated host callback.
Pure receivers support bounded digest-pinned imported Programs. The registry's
optional `programs` map contains data file references, never executable JS config.
The existing activation runner can install host adapters for concurrent frontiers
but rejects task adapters because each path has a separate Runtime budget.
TaskHost is the shared-budget task scheduler; ordinary Program `parallel` keeps
its existing serial reference semantics.

## What the pilot proves

Three synthetic workers are assigned manually, by an explicit Program 1.0, and
through rule-generated groups. All three conditions must achieve the same
three predefined outcomes without duplicate work. Two completion schedules must
produce the same logical replay digest. Three public standard documents also
form overlapping groups using authored metadata and file fingerprints.

This proves local wiring and deterministic organization, not superior task
correctness, lower model cost or better knowledge extraction. There is no live
LLM comparison or independent human review. A separate Python implementation
checks exact rule membership and recorded task consistency on this corpus;
that is narrower than complete Runtime conformance. The computed pilot adds four
input cases, three arithmetic/branch specialists, nested Programs and an exact
recorded AI summary. The summary waits for accepted dependencies; changing risk
changes outputs. Both task completion schedules must match logical replay.
This is a stronger integration test, still not a model-quality experiment.

The independent checker also covers bounded neighborhood expansion, recorded
provider memberships, task context attenuation and chronological histories.
`validate:graph-program-conformance` compares static Program 1.1 catalog/effect
bindings. Both conformance scripts require explicit `--checker` and `--python`
paths to a separate Python implementation; they never install or call a model.

## Remaining release gates

- Expand independent dynamic-expression/execution coverage beyond the bounded
  Program 1.1 static-binding and recorded-history corpus.
- Add a transport/isolation contract before enabling external providers.
- Review remaining recovery gaps during unindexed Runtime directory allocation.
- Reconcile the 2.2 baseline and refresh freeze evidence for the exact 2.3 commit.
- Complete security, cross-platform and representative human-reviewed pilots.

No installed Federation update, paid inference or publication is part of this
preview. Derived knowledge proposals remain separate from canonical updates.
