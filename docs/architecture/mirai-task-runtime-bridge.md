# Task Runtime Bridge

Status: development contract, not a release or deployment approval.

Program 1.1 uses the existing `call` instruction and an explicitly installed
`mirai_tasks` adapter. `submit`, `accept`, `cancel` and `reconcile` declare
`task_control`; `dispatch` declares `task_dispatch`; `inference` declares
`inference_invoke`; `inspect` and `collect` declare `task_read`. No operation is
pure. One dispatch executes exactly one fixed, host-registered task.

Every call binds a host registry digest, plan digest and optional task id.
The registry binds the immutable graph, task policy, receiver contracts and
one fixed plan. The reference bridge requires exactly one plan per registry so
its shared model-call budget cannot be multiplied by registering extra plans.
The registry digest includes the task operation contract. Runtime scope also
binds the argument digest, calling Program,
input, node, run and policy. Graph values cannot register callbacks or widen
the plan. Inference is never hidden within Program dispatch.

New effects require capability/approval contract 1.2 and receipt contract 1.1.
Legacy effects retain their current versions and default policies; Program
1.0 cannot use these new effects. Mixed approvals explicitly bind individual
scopes; they are not wildcard consent. Task mutation and inference require
`--apply` plus a signed local approval even if a host rule omits that demand.
No default policy grants the new operations. Read operations require a host
capability, but do not themselves grant access to an unregistered plan.

The bridge reuses EffectCoordinator, RunStore, TaskHost, receipts and leases.
Task storage is isolated per calling Runtime run. Parallel calls share one
host lease and atomic root-budget reservations; another process cannot dispatch
the same plan concurrently. An uncertain invocation is not retried implicitly.
Acceptance remains distinct from execution and binds an independent reviewer
and exact result digest. It never authorizes a canonical graph update.

New task ledgers use contract 1.2 with an atomic chronological history; scoped
ones include an opaque execution-scope digest in provider idempotency keys.
Legacy unscoped 1.0 and scoped 1.1 ledgers remain readable. A second
parent run must not reuse the first run's provider key. Task reads return bounded
status summaries, not an entire private ledger. Read-only adapter preflight
checks owner identity before preparing a receipt; a missing reviewer approval
can therefore be supplied on resume without retrying already verified work.

`historyReplayRecord` checks each recorded reservation, output, verification,
acceptance, cancellation and reconciliation in order. Each delta binds its
previous event and before/after state digests. History and current state use one
extension CAS write. Readback checks history budgets and transition legality;
providers are never called during replay. This checks recorded consistency, not
clock authenticity, evidence truth or authenticated reviewer identity.
`replayRecord` retains the old structural projection for logical outcome
comparison: parallel completion order may change history but not accepted outputs.

Initial extension state is written before the Runtime run index publishes the
run. Interruption after publication can reopen the same ledger and deadline.
An interruption earlier, during unindexed directory allocation, remains a
fail-closed orphan requiring host recovery; no automatic deletion is performed.

The existing Program interpreter still serializes its `parallel` branches;
TaskHost's bounded parallel dispatch is tested independently. Concurrent Program
dispatch through activation and nested-program approval scopes still need
separate conformance coverage before a release claim.

This local reference adapter supports trusted in-process pure Programs and
mock/recorded AI providers. Process isolation, paid providers and live external
effects are outside this batch. Abort stops waiting; arbitrary host callbacks
must cooperate to stop their underlying work.
