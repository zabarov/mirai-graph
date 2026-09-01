# Mirai Internal Security Baseline

Date: 2026-09-01
Status: internal engineering review; not an independent security verdict
Reviewed baseline: `fd53b6a05afa2d60d1e54d404f9cfed0018a4f5e`

## Executive Summary

The bounded Runtime security suite, dependency audit and focused review found
no unresolved critical or high finding in the reference adapters. One
medium-severity custom-policy scope issue and two defense-in-depth approval
checks were corrected in this batch. This report supports engineering
hardening only and does not close the independent security review gate.

## Findings

### SEC-001: Capability path prefix lacked a segment boundary

Severity: medium. Status: fixed and regression-tested.

A custom resource prefix such as `./safe` previously used a plain string prefix
comparison and could also match `./safe-escape`. The default policy grants the
repository/workspace root and was not narrowed to this shape, but future custom
policies could rely on incorrect subdirectory isolation.

The provider now distinguishes filesystem segment prefixes from namespace
prefixes such as `command:`. See `src/runtime/capabilities.ts:55` and the
regression in `test/runtime/security-fuzz.test.cjs`.

### SEC-002: Existing approval key shape and permissions were not checked

Severity: low. Status: fixed.

An existing local approval key is now rejected when it is not exactly 32 bytes
or, on POSIX systems, is readable by group or others. See
`src/runtime/approval.ts:19`.

### SEC-003: Approval lifetime accepted invalid caller values

Severity: low. Status: fixed.

Approval creation now requires a nonempty approver and a positive integer TTL
of at most 24 hours. Runtime verification still enforces expiry and binding.
See `src/runtime/approval.ts:49`.

## Existing Controls Rechecked

- path traversal, absolute paths and symlink escapes fail closed;
- test commands are host-allowlisted, use `shell: false` and a reduced environment;
- grants are bound to request, run, Program, node, adapter, action and resource;
- approvals are digest-bound and locally signed;
- uncertain receipts block completion and automatic retry;
- replay stubs effects rather than invoking adapters;
- inspect, evidence export and operations status redact sensitive Runtime state.

## Dependency Audit

`npm audit --json --package-lock-only` reported zero known vulnerabilities
across 10 dependencies: zero critical, high, moderate, low or informational
findings. This is a point-in-time registry result, not a future guarantee.

## Verification

- 27 focused governed-runtime and security-fuzz tests passed;
- custom prefix escape is rejected;
- invalid approval TTL and empty approver are rejected;
- Runtime health reports do not expose capability refs or sandbox paths;
- full release suite remains required after integration.

## Residual Risks

- custom adapters remain trusted code and require their own review;
- host compromise can expose local approvals and receipts;
- no network or generic production adapter is approved by this report;
- distributed multi-host coordination remains outside the reference Runtime;
- an independent reviewer must execute the external review packet before the
  release gate may change to passed.
