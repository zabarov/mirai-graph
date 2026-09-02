# Mirai 2.2 Controlled Observe Pilot Review

Status: pilot gate passed with explicit limitations; not release authorization.

Reviewed revision: `eeb048121da54123566bc73f9024f37f8ddd688e`.

## Decision

An isolated AI-assisted reviewer verified the fresh candidate report after the
output, provenance, claim and private-path corrections. The official validator,
19 negative fixtures and 13 source tests passed. All 57 independently mutated
invalid reports were rejected. No unresolved Critical, High or Medium finding
remained in this bounded pilot-review scope.

The report is preserved byte-for-byte. Its `independent_review: pending` field
records generation time; the later review is this separately bound
[review artifact](independent-review.json), not a mutation of execution evidence.

## Verified Boundaries

- The exact revision and clean review worktree were unchanged before and after.
- Runner, dependency lock, runtime build, all cases and report digests matched.
- All four source before/after Git-state and snapshot receipts matched.
- Runs stayed in `observe_suggest` with zero allowed technology drafts,
  canonical writes, protected changes or production effects.
- Previous Node-version path suffixes are rejected by whole-string validation.
- No private source content or path was disclosed in the reviewed report.

## Limits

Three private inputs were initially dirty, and their original content cannot be
independently replayed from public digests. The application-level mutation audit
is not an OS syscall trace. Three cases retain 42, 39 and 50 conversion
diagnostics. This supports controlled read/proposal integration, not complete
source assimilation, correct extraction, productivity improvement or scientific
proof. The adversarial corpus is bounded, not exhaustive.

This is owner-authorized AI-assisted review, not external human peer review.
Public conformance, cross-platform CI and stable publication are separate gates.
