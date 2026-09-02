# Mirai 2.1 Isolated Security Review

Status: passed for production-read release preparation with limitations

Reviewed revision: `c946d7306099ae03f71cc46f72bcba981e8da03a`

## Decision

Two isolated AI-assisted executors who did not implement the reviewed changes
reproduced the corrected runtime path-swap and Git-configuration attacks from
fresh public checkouts. They found no unresolved critical or high finding.

This satisfies the owner-approved production-read review method recorded in
`mirai-independent-review-method-decision-2026-09-02.json`. It is not an
external human audit and cannot authorize production writes.

## Verified Corrections

- A symbolic-link sandbox root is rejected before repository access.
- Repository-controlled Git fsmonitor and external diff helpers do not run.
- Git reads use an empty, unique, per-invocation configuration home and remove
  it after execution.
- A run directory replaced by an intermediate symbolic link after
  initialization is rejected before reading or writing outside runtime home.
- The exact candidate passes the full governed-runtime suite locally.
- Public CI run
  [33630896877](https://github.com/zabarov/mirai-graph/actions/runs/33630896877)
  passes all 11 jobs, including Mirai Program, clean-room package and context
  traversal on Linux, macOS and Windows.
- Public CodeQL run
  [33630896792](https://github.com/zabarov/mirai-graph/actions/runs/33630896792)
  passes at the same revision.

## Limits

- The exact symbolic-link probes are POSIX-specific. Windows passes the broader
  runtime and ordinary Git-read suites but skips those fixtures.
- No open-ended concurrent filesystem race campaign was performed.
- No production-write adapter, live network effect or secret-changing effect
  was reviewed or authorized.
- Comparative effectiveness remains a separate scientific question.

The machine-readable result is
`mirai-independent-ai-security-review-2026-09-02.json`.
