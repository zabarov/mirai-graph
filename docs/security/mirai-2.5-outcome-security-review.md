# Mirai 2.5 Outcome Completion Security Review

Status: internal pre-review for `2.5.0-alpha.1`; independent review pending

## Executive Summary

The Outcome Completion extension is fail-closed for malformed inputs, missing
or unauthorized evidence, stale evidence, conflicts and attempts to grant
execution or canonical-write authority. No critical or high-severity finding
remains open in the local alpha implementation. This document is not an
independent security assessment and does not authorize production rollout.

## Closed Findings

### OC-001: Critical slot could opt out of evidence

Severity: high, closed.

The contract validator now rejects every critical slot whose
`evidence_required` value is not true (`src/outcome/validator.ts:16-22`). The
schema independently enforces the same invariant. Tests cover the attempted
weakening.

### OC-002: Untyped JavaScript inputs could bypass TypeScript assumptions

Severity: high, closed.

Assessment and candidate binding now validate candidate and evidence shapes,
trust-boundary flags and full artifact digests before reading their content
(`src/outcome/validator.ts:26-40`, `src/outcome/assessment.ts:81-88`).

### OC-003: Nested aggregation fabricated evidence quality

Severity: high, closed.

Aggregation no longer reconstructs evidence with invented authority or
freshness. It preserves child evidence/source references, detects divergent
confirmed values and derives the parent status without creating synthetic
evidence records (`src/outcome/assessment.ts:111-164`).

### OC-004: Noncritical conflict block policy was ignored

Severity: medium, closed.

Status selection now blocks any conflicting slot when the contract selects
`noncritical_conflict=block` (`src/outcome/assessment.ts:66-78`).

## Residual Boundaries

- SHA-256 digests provide deterministic integrity, not identity or
  authenticity. A host must admit evidence and accepted child assessments
  through existing policy, capability and Task Runtime boundaries.
- The extension never grants an effect, approval, capability or canonical
  update. An effectful workflow still requires the existing Mirai Runtime and
  its approval receipts.
- Retrieval content and model candidates remain untrusted data even when their
  container digest is valid.
- Public fixtures are synthetic shadow slices. They do not establish resistance
  to every provider-specific prompt injection or production integration.

## Required External Gates

- independent review of forged evidence, authority and parent/child bindings;
- cross-platform clean-room execution against the exact candidate commit;
- controlled product pilots with human review;
- public checker branch and passing CI before `release_gate_eligible=true`.
