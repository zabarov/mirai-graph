# Mirai Durable Execution

Status: `2.0.0-alpha.3` reference contract

## Purpose

Mirai Runtime preserves enough host-local state to explain what was attempted,
determine whether an effect was verified and continue safely after a process
failure. It does not claim distributed transactions or exactly-once delivery.

The default run root is:

```text
${MIRAI_HOME:-~/.mirai}/runs/<graph-id>/<run-id>/
```

Each run contains a run record, append-only events, checkpoint, capability and
policy records, effect receipts and a governed episode. Sensitive host paths,
approval material and raw effect outputs stay in this local contour.

## Receipt Lifecycle

```text
prepared -> executed -> verified
    |           |
    v           v
  failed     uncertain -> reconcile -> verified or blocked
                                |
                                v
                           compensated
```

Every effect has a stable idempotency key derived from the run, Program digest,
node, adapter, operation, arguments and effects. A verified receipt is reused
during resume instead of executing the effect again. An `uncertain` receipt
blocks automatic retry until adapter-specific reconciliation proves the
external state.

Writes use a renewable run lease, monotonically increasing lease generation,
owner fencing checks, compare-and-swap revisions, temporary files, atomic
rename and readback verification. A process that loses the current
token/generation cannot continue through the RunStore write API. The reference
filesystem lease is a single-host mechanism; cross-process expiry-boundary
behavior remains in scope for independent security and recovery review.
Compensation is explicit and can itself fail; failed compensation is a blocker,
not a successful completion.

## Resume, Cancel And Reconcile

- `resume` validates the checkpoint and immutable artifacts, reconciles open
  receipts and deterministically re-enters the Program;
- `cancel` records a terminal cancellation but does not pretend to undo
  already verified effects;
- `reconcile` verifies an executed or uncertain effect against current
  external state before allowing further work;
- corrupted checkpoints, stale artifacts and unresolved receipts fail closed.

The alpha.3 implementation restarts deterministic Program evaluation and uses
receipts to deduplicate verified effects. Fine-grained continuation from an
arbitrary in-memory node is not claimed.

## Episode And Replay

A governed episode records decisions, output digests and effect stubs. Replay
executes the Program against those stubs; it never repeats real external
effects. A mismatch in Program digest, call order, arguments, output or trace
is reported as a replay failure.

Sanitized evidence export removes raw inputs, raw adapter result content,
capability grants, approval material, backup references, sandbox paths and
secret-like data. Exported evidence can support review but cannot authorize an
effect or canonical graph update.

## Guarantees And Limits

Mirai 2.0 uses at-least-once execution with durable receipts, deduplication,
verification and compensation. It does not promise exactly-once effects,
automatic repair of unknown external state or safety of adapters outside the
reference set.

See [Capabilities And Effects](mirai-capabilities-and-effects.md) and
[Mirai Runtime](mirai-runtime.md).
