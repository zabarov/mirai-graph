# Mirai Production Invariant Hardening

Date: 2026-09-02
Status: internal corrections complete; independent review still required

## Scope

This batch corrected six fail-closed invariants identified by a focused review
of the Mirai 2.0 Runtime and additive 2.1 project/activation surfaces:

1. activation Program references, Project Capsule entrypoints and evidence
   destinations are confined against symbolic-link substitution;
2. approvals and capability grants bind the run, Program, input, policy,
   evaluated arguments, node, adapter, operation, resource, effects and budget;
3. activation validation enforces node, depth, fan-out, iteration and parallel
   budgets, while elapsed-duration overflow blocks acceptance;
4. sanitized evidence is assembled from an explicit field allowlist and omits
   adapter-controlled verification text;
5. Program JSON rejects duplicate members and runtime validation rejects
   unknown node fields; public/runtime schema surface parity is regression
   tested;
6. Project Capsule manifests reject unknown top-level and nested fields.

## Contract Effect

Capability request, capability grant, policy decision and approval receipt
artifacts now use contract `1.1.0`. Approval creation consumes exact capability
request artifacts rather than a broad effect list. A named blocked run can be
resumed with the matching signed receipt; changed material inputs fail closed.

## Claim Boundary

Passing repository tests demonstrates implementation consistency for the
covered fixtures. It does not replace independent security review, authorize a
live adapter, approve a production write or establish stable `2.0.0` release
readiness. Custom adapters and host environments require their own review.
