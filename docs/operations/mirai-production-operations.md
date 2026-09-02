# Mirai Production Operations

Status: operator contract candidate; no live deployment authorized

This runbook turns the Runtime safety model into an operator decision path. It
supplements the reference operations guide and does not enable excluded live
adapters.

## Before A Run

Record the exact Program, graph snapshot, policy and project-lock digests.
Confirm the sandbox, adapter allowlist, budgets, retention policy, evidence
destination and responsible owner. A write-capable operation additionally
requires current backup evidence, a tested rollback or compensation path and a
signed approval bound to this run and effect scope.

Do not enable the reference `process_run` adapter in production-read or
production-write profiles. It is a local-development test runner, not an OS or
network sandbox. Production profiles must record
`host_process_run_allowed=false` and use only adapters with an independently
reviewed isolation boundary.

## Health Signals

- run state and last durable event;
- active lease and checkpoint revision;
- prepared, executed, verified, failed, uncertain and compensated receipt counts;
- pending approval and capability expiry;
- budget consumption and blocked paths;
- evidence-export status and retention deadline.

Health data must not expose capability tokens, approval signatures, secrets,
raw environment values or unrestricted effect payloads.

## Stop Conditions

Stop new effects when any of the following is observed:

- Program, project lock, graph snapshot or policy digest mismatch;
- missing, expired or cross-run capability;
- write requested without a bound approval;
- `uncertain` receipt or unknown external state;
- stale lease, corrupted checkpoint or failed compare-and-swap;
- failed compensation, path escape or command allowlist violation;
- evidence required for completion is absent.

## Incident And Recovery

1. Freeze new effects for the affected run.
2. Preserve run state, checkpoint, event ledger and receipts.
3. Inspect and reconcile the owning external system without deleting receipts.
4. Classify the effect as verified, failed, uncertain or compensated.
5. Resume only when the receipt and external state agree.
6. Export sanitized evidence and record limitations.
7. Route reusable findings to Kaizen; canonical changes remain proposal-only.

An uncertain effect is never automatically retried. A failed compensation is
an operator escalation, not a successful terminal state.

## Backup And Rollback

Read-only runs require a reproducible source snapshot rather than a mutable data
backup. Write-capable runs require operation-specific backup evidence and a
rollback or compensation test before approval. Rollback is forbidden when
post-run state changed outside the recorded effect; reconcile and escalate
instead.

## Initial Service Objectives

These are guardrails for pilots, not public availability promises:

- zero unauthorized effects;
- zero accepted completion with missing evidence;
- zero duplicate verified effects in crash/retry suites;
- all uncertain effects visible and blocked;
- every terminal run has inspectable sanitized evidence or an explicit reason.
