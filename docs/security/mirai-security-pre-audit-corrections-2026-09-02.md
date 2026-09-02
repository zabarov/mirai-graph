# Mirai Security Pre-Audit Corrections

Date: 2026-09-02  
Status: internal correction disposition; independent review still required  
Correction revision: `95915799bf03fc6a1086cbb4a390fbc31cb8a613`

## Result

The internal pre-audit findings were reconciled against the current branch and
closed or bounded as follows.

| Finding | Disposition |
| --- | --- |
| Approval scope binding | Closed before this batch: approval is bound to run, Program, input, policy and exact capability-request scope. |
| Activation policy binding | Closed: runtime recomputes the effective host policy digest and rejects a mismatched activation plan before creating runtime state. |
| Activation resource limits | Closed for the reference host: plan budgets cannot exceed trusted host ceilings, and the ceiling digest is recorded in activation evidence. |
| Activation path and duplicate-key parsing | Closed before this batch through confined path resolution and duplicate-key rejection. |
| Evidence redaction | Closed before this batch through explicit output allowlists. |
| Host process execution | Bounded, not promoted: `process_run` is explicitly local-development-only, uses a minimal synthetic environment and is forbidden in production profiles. It is not an OS or network sandbox. |
| Runtime lease ownership | Strengthened: leases renew, carry monotonic generations and serialize lease transitions with fenced mutations through a cross-process mutation lock. Adversarial expiry-boundary behavior remains an independent review target. |

## Verification

- governed Runtime: 38/38 passed;
- Mirai 2.1 suite: 51/51 passed;
- property/security fuzz: 9/9 passed;
- independent Python graph-native conformance: matched;
- full `npm run release:check`: passed on Node.js 24.20.0.

## Boundary

This document is engineering evidence, not an independent security verdict.
It does not authorize production-write, a live adapter, stable release metadata,
publication, deployment or canonical graph updates.
