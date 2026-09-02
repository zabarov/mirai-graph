# Mirai Independent Security Review Packet

Status: ready for external review; no independent verdict recorded

Current review request: `mirai-independent-security-review-request-2026-09-02.json`,
fixed to revision `9507a9cb11487de25e9a2e905a4f2f2084ab7c6e`.

## Purpose

This packet lets a reviewer who did not implement the Runtime evaluate the
security boundary without access to private credentials or customer data. An
internal test result cannot close the independent-review gate.

The current internal baseline is documented in
[`mirai-internal-security-baseline-2026-09-01.md`](mirai-internal-security-baseline-2026-09-01.md).
Reviewers should treat it as a map of tested claims, not as a trusted verdict.
Repository-level CodeQL, dependency monitoring and the public disclosure
boundary are supporting controls defined in `.github/workflows/codeql.yml`,
`.github/dependabot.yml` and `SECURITY.md`. Automated results do not replace
this review.

## Review Scope

The reviewer should assess:

- Program and expression parsing, duplicate keys and unsafe input;
- path traversal, symlinks and sandbox boundary;
- adapter command injection and environment leakage;
- capability forgery, expiry, cross-run and cross-node reuse;
- approval signature, scope and replay;
- crash points, idempotency, uncertain receipts and reconciliation;
- compensation failure and false terminal completion;
- evidence/archive redaction and secret leakage;
- project manifest attempts to mint authority;
- graph explosion, activation budgets and denial of service.
- ancestor symlinks for host-local runtime, approval and mandate roots;
- monotonic fencing generations across lease release and process restart;
- stale mutation-lock recovery, owner checks and quarantine evidence;
- concrete runtime composition for production-readiness claims;
- exclusion of host-local `.mirai` state from the packed npm artifact.

## Reproducible Commands

```bash
npm ci
npm run test:mirai-property-fuzz
npm run test:mirai-alpha3
npm run test:mirai-2.1
npm run validate:shadow-differential
npm run validate:bounded-production-write-candidate
npm run validate:production-readiness
npm run validate:clean-room-install
npm run release:check
```

The reviewer may add adversarial fixtures but must retain their exact inputs,
platform, Node version and result digests.

## Required Output

The signed or otherwise attributable report must contain reviewer independence
declaration, reviewed commit, scope, methods, findings with severity and
reproduction steps, unresolved risks and one verdict:

- `pass_for_production_read`;
- `pass_for_bounded_production_write` with explicit adapter scope;
- `changes_required`;
- `not_reviewable`.

Only a real independent reviewer may change the security review gate to
`passed`. A clean internal suite is supporting evidence, not that verdict.

The reviewer should copy
`mirai-independent-security-review-request-2026-09-02.json`, replace the
pending reviewer fields, set `status=complete` and
`evidence_class=external_review`, then
run:

```bash
npm run validate:security-review-contract -- path/to/review-result.json
```

`release_gate_eligible=true` means the structured result is complete enough to
enter owner review. It does not apply the gate automatically.

## Secrets And Private Evidence

Do not include `.env`, tokens, grants, approval signatures, private paths or raw
customer traces. Report variable names and sanitized evidence references only.
