# Production Readiness

Status: `2.0.0-rc.1` candidate contract

Production readiness is evaluated for a bounded use, not granted to Mirai as a
whole. A structurally valid Program, successful test suite or exported episode
does not authorize a live action.

## Tiers

| Tier | Meaning |
| --- | --- |
| `experimental` | Synthetic fixtures and local development only. |
| `pilot` | Controlled, reversible use with explicit supervision. |
| `production_read` | Read-only discovery, inspection and simulation under host policy. |
| `production_write` | Effectful use after stable contracts, independent reviews and operation-specific approval. |

The tier is a readiness statement. It is not a capability grant, approval
receipt or permission to update canonical graph state.

## Required Control Loop

```text
bounded target
-> contract inventory
-> capability and approval policy
-> sandbox and effect boundary
-> backup and rollback
-> monitoring and retention
-> incident/reconciliation route
-> independent review status
-> tier verdict
```

`production_write` must fail closed when either security or human review is not
independent and passed, any execution contract is not stable, an effect has no
capability, or backup/recovery evidence is missing.

## Current Boundary

The reference implementation qualifies for `production_read` in read-only and
sandbox simulation scenarios. It does not currently qualify for generic
`production_write`. Live adapters require their own threat model, policy,
idempotency, reconciliation, compensation and owner approval.
