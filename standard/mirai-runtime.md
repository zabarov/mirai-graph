# Mirai Runtime

Status: capability-gated reference runtime available in `2.0.0-alpha.3`

## Purpose

Mirai Runtime executes a validated Mirai Program under explicit budgets,
capabilities and durable evidence. It is not a general-purpose language
runtime and does not replace JavaScript, Python, databases or owner sources.

## Alpha.2 Pure Execution

The reference interpreter executes only programs whose allowed effects are
`pure`. It supports every Mirai Program control node, produces deterministic
decision traces and pure episodes, and can replay an episode without adapters.

Parallel branches are scheduled in declared order and merged by an explicit
join policy. This makes the trace independent from host Promise timing. Await,
timeout and retry use deterministic logical time in pure execution. Execution
budgets for steps, nesting depth, iterations, parallel width and logical
duration fail closed.

The language corpus under `conformance/corpus/pure/` is portable evidence for
the bounded fixtures. Passing it does not authorize effects or prove project
correctness.

## State Separation

The runtime must keep these states separate:

1. canonical graph state;
2. immutable Program IR;
3. host-local run state;
4. external world state;
5. sanitized evidence ledger;
6. proposal and Kaizen queue.

An episode can produce evidence or a proposal. It cannot modify the canonical
graph or authorize its own next effect.

## Reference 2.0 Core Effects

- pure computation;
- repository read;
- Git read and diff;
- sandbox patch;
- allowlisted test command;
- human approval.

Network, production, secret-changing, financial and public-publishing adapters
remain outside core 2.0. Workspace writes and allowlisted process execution
require both `--apply` and a signed host-local approval receipt.

## Durability Contract

Runs use host-local checkpoints, events, capability grants, receipts and an
episode record. Effects use stable idempotency keys. The runtime promises
at-least-once execution with deduplication, verification and compensation, not
exactly-once execution. An `uncertain` receipt blocks automatic retry until
reconciliation.

See [2.0 Architecture Decisions](../docs/architecture/mirai-2.0-decisions.md).
