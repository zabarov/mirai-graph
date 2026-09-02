# Mirai Runtime Threat Model

Status: `2.1.0-rc.1` reviewed security baseline

## Assets And Trust Boundaries

Protected assets include canonical graph state, source repositories, sandbox
files, approval material, capability grants, secrets, external-system state and
audit evidence. The Program is untrusted declarative input. Graph content and
generated context are not runtime authority. Host policy, approval verification
and adapter configuration form the trusted execution boundary.

Runtime state is host-local. Public evidence is a sanitized projection and must
not contain raw effect payloads, capability grants, approval signatures,
sandbox paths or secrets.

## Threats And Controls

| Threat | Required control |
| --- | --- |
| Program requests an undeclared effect | Static validation and policy rejection before adapter invocation. |
| Program forges or reuses authority | Opaque run/node/resource-bound capability with expiry and policy digest. |
| Activation plan names an untrusted policy or excessive budget | Runtime recomputes the effective host policy digest and enforces trusted host ceilings before creating run state. |
| Stale runtime owner continues after takeover | Renewable lease token, monotonic generation fencing and a cross-process mutation lock serialize lease transitions with fenced RunStore writes; adversarial expiry-boundary stress remains an independent-review target. |
| Approval is forged or reused | Host signature verification bound to Program and sandbox digests and allowed effects. |
| Path traversal or symlink escape | Canonical sandbox resolution, symlink rejection and readback verification. |
| Command injection | Host-defined command IDs, argument policy, no shell and sanitized environment. |
| Local test command inherits host authority | `process_run` is local-development-only, receives a minimal synthetic environment and is forbidden by production readiness profiles; it is not an OS/network sandbox. |
| Secret leakage | Minimal adapter environment, redacted inspect output and sanitized evidence export. |
| Crash duplicates an effect | Stable idempotency key, durable receipt, reconcile-before-retry and compensation. |
| Uncertain external state is treated as success | `uncertain` receipt blocks resume and completion until reconciliation. |
| Replay repeats real effects | Replay consumes recorded effect stubs and never invokes live adapters. |
| Program or episode updates canonical graph | Separate proposal queue and owner-approved canonical write path. |
| Resource exhaustion | Step, depth, iteration, parallel-width, duration and adapter budgets. |
| Evidence tampering hides failure | Digest binding, append-only events and independent conformance checks. |

## Residual Risks

- The reference runtime cannot guarantee exactly-once effects in external
  systems; it uses at-least-once execution, deduplication and compensation.
- A malicious or defective custom adapter can violate assumptions outside its
  reviewed contract.
- Host compromise can expose local grants, approvals and raw receipts.
- Sanitized evidence can prove internal consistency, not truth of hidden
  external state.
- Denial of service and distributed coordination across multiple hosts are not
  fully addressed by the single-host reference runtime.

## Out Of Scope For Core 2.0

Network, production, secret-changing, financial and public-publishing adapters
are excluded. Adding one requires a separate threat model, policy, verification,
idempotency, compensation and evidence review. Stable release does not make an
excluded adapter safe.
