# Mirai Runtime Operations Guide

Status: `2.1.0-rc.1` reference operations

## Runtime Home

Use a private host-local directory:

```bash
export MIRAI_HOME="$HOME/.mirai"
chmod 700 "$MIRAI_HOME"
```

Each run is stored under `runs/<graph-id>/<run-id>/`. Do not commit this tree or
edit checkpoints, grants or receipts manually. Back up host state before a
high-value run if recovery depends on retained receipts.

## Normal Lifecycle

1. Validate and compile the Program.
2. Simulate pure control flow and inspect requested effects.
3. Select an isolated sandbox.
4. Start a named apply run without approval to materialize the exact denied
   capability requests, then review their Program, input, argument, resource,
   policy and sandbox bindings.
5. Create the host approval from those exact request artifacts.
6. Resume or restart that same run with `--apply --approval <receipt>` only at
   the approved write boundary. A receipt cannot authorize a different run or
   changed material inputs.
7. Run without `--apply` first where the adapter permits it.
8. Inspect the terminal status and export sanitized evidence separately.

```bash
mirai run program.mirai.json --input input.json --sandbox ./sandbox --apply --run-id run.review-001
mirai approval create program.mirai.json --sandbox ./sandbox \
  --requests "$MIRAI_HOME/runs/<program-id>/run.review-001/capability-requests" \
  --out approval.json
mirai resume run.review-001 --approval approval.json
mirai operations status
mirai inspect <run-id>
mirai evidence export <run-id> --out evidence
```

`operations status` is read-only. It aggregates run and receipt states, active
runs and reconciliation needs without exposing sandbox paths, capability grants
or effect payloads. A blocked report requires operator review before new
effects are started.

## Recovery

- Use `mirai resume <run-id>` after a clean process interruption.
- Use `mirai reconcile <run-id>` when a receipt is `executed` or `uncertain`.
- Do not delete an uncertain receipt and retry the effect manually.
- Use `mirai cancel <run-id>` to stop further execution; cancellation does not
  undo verified effects.
- If compensation fails, preserve the run directory and treat the run as
  blocked until an owner reviews external state.
- If `operations status` or a write reports `run_mutation_lock_active`, first
  verify that no process still owns the run. Recovery is explicit and keeps the
  old lock in quarantine with a host-local receipt:

```bash
mirai operations recover-mutation-lock <run-id> \
  --minimum-age-ms 30000 \
  --confirm-stale-lock-recovery
```

The command refuses a live PID, a recent lock, malformed owner evidence or an
unknown owner status. Do not delete `mutation.lock` manually.

## Evidence And Retention

Sanitized export is the only portable runtime artifact. Raw run state may
contain sensitive operational metadata and remains host-local. Set retention
according to the project data policy; do not shorten retention while a run is
uncertain, disputed or under audit.

An exported episode or receipt is evidence, not authorization. Learning and
canonical graph changes remain proposal-only until their separate owner gate.

## Upgrade And Compatibility

Keep immutable Program JSON and contract versions with retained runs. Do not
resume a run under a changed Program digest. Use the 1.4 migration command in
dry-run mode and review ambiguous bindings manually. API and file layout may
still change before `2.0.0-rc.1`.

## Incident Checklist

- stop new effects for the affected run;
- preserve `run.json`, events, checkpoint and receipts;
- preserve mutation-lock quarantine and recovery receipts;
- inspect status without exposing grants or raw result content;
- reconcile external state using the owning adapter;
- record verified, failed, uncertain or compensated outcome;
- export sanitized evidence;
- create a fix or Kaizen proposal without mutating canonical state automatically.
