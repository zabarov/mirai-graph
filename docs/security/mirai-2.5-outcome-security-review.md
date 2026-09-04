# Mirai 2.5 Outcome Completion Security Review

Status: AI-assisted RC engineering review complete; external human review not claimed

## Executive Summary

The Outcome Completion extension is fail-closed for malformed inputs, missing
or unauthorized evidence, stale evidence, conflicts and attempts to grant
execution or canonical-write authority. An isolated AI-assisted reviewer found
five reproducible false-green paths. All were reproduced by the integration
owner, fixed and covered by TypeScript and independent Python checks. The
reviewer task was interrupted after recording findings, so this is not an
external human audit and does not authorize production rollout.

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

### OC-006: Serialized evidence could admit itself

Severity: high, closed.

Assessment now requires a host-provided admission verifier bound to the policy,
the complete evidence-set digest and admitted receipt digests. Serialized model
or project content cannot supply this verifier (`src/outcome/assessment.ts`).

### OC-007: Child contract could weaken parent policy

Severity: high, closed.

Aggregation checks purpose, domains, effect boundary, conflict policy,
criticality, evidence requirement, authority and freshness before recomputing a
child assessment (`src/outcome/assessment.ts`).

### OC-008: Delivery trusted a serialized assessment

Severity: high, closed.

Delivery requires a host verification callback. The CLI reloads the contract,
candidates and evidence, applies host admission and recomputes the assessment
before planning delivery (`src/cli/index.ts`).

### OC-009: Contract could define away completion proof

Severity: high, closed.

Every contract must now contain at least one required critical slot with
evidence enabled. The JSON schema, TypeScript validator and independent Python
checker enforce the same rule.

### OC-010: Fully failed pilot could recommend RC review

Severity: medium, closed.

The controlled-pilot scorer now returns `blocked_by_outcome_failure` when all
scored runs are hard failures, and its validator checks this fail-closed branch.

## Residual Boundaries

- SHA-256 digests provide deterministic integrity, not identity or
  authenticity. A trusted host must own admission state and policy decisions.
- The extension never grants an effect, approval, capability or canonical
  update. An effectful workflow still requires the existing Mirai Runtime and
  its approval receipts.
- Retrieval content and model candidates remain untrusted data even when their
  container digest is valid.
- Public fixtures are synthetic shadow slices. They do not establish resistance
  to every provider-specific prompt injection or production integration.

## Remaining Boundaries

- the executable controlled pilot uses condition-blind AI review, not blinded
  external human evaluation;
- product-specific production-read and production-write reviews remain local to
  each deployment;
- stable release promotion and live effects require separate approvals.
