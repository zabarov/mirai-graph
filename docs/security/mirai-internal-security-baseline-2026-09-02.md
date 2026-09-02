# Mirai Internal Security Baseline

Date: 2026-09-02
Status: internal engineering evidence; not an independent security verdict
Reviewed revision: `95915799bf03fc6a1086cbb4a390fbc31cb8a613`

## Result

The bounded security/property corpus passed 9 of 9 tests, and the governed
Runtime suite passed 38 of 38 tests on Node.js 24.20.0. The focused recovery
drill passed 9 of 9 cases. No unauthorized effect, duplicate verified effect
or accepted uncertain effect was observed.

The correction revision additionally binds activation execution to the exact
effective policy digest, enforces trusted host budget ceilings before runtime
state exists, isolates the local-development test runner from inherited
`HOME`/`TMPDIR` and arbitrary environment values, and excludes that runner from
production profiles. Runtime ownership now uses renewable leases with monotonic
generation fencing through the RunStore write API.

The new Shadow Differential contract also passed its positive and negative
fixtures. It compares a candidate activation with accepted evidence, detects
scope and effect expansion, and always returns `activation_allowed=false` and
`canonical_write_allowed=false`.

## Environment Finding

The machine's linked Homebrew Node.js 25.8.0 was unusable because its expected
simdjson dynamic library was missing. Node.js 24.20.0 was installed and used
explicitly for the production-hardening checks. This is an operator-environment
finding, not a Mirai Runtime defect, but production runbooks must pin a
supported Node path instead of relying on an ambiguous global executable.

## Residual Boundary

- custom adapters remain trusted code and require adapter-specific review;
- no network, production service or generic write adapter is approved;
- the reference `process_run` adapter is not an OS/network sandbox and remains
  local-development-only;
- cross-process lease takeover at the exact expiry boundary remains an explicit
  independent-review and stress-test target;
- self-hosting production-read evidence is not an external deployment;
- this internal baseline cannot close the independent-review gate.

The external request is fixed to the reviewed revision in
`mirai-independent-security-review-request-2026-09-02.json`.
