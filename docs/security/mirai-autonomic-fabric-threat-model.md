# Mirai Autonomic Fabric Threat Model

Status: `2.2.0` development security contract

## Protected Assets

- source credentials and confidential content;
- source authority and identity mappings;
- protected invariants and autonomy envelopes;
- canonical graph, Programs, approvals and capability grants;
- evidence history and rollback material.

## Threats And Required Controls

| Threat | Required control |
|---|---|
| Prompt injection in content | Treat source content only as data; it cannot issue instructions or capabilities. |
| SSRF and unsafe redirects | Host allowlist, DNS/IP validation, redirect and byte budgets. |
| SQL mutation | Predefined read templates, read-only DB role, timeout and row limit. |
| S3 scope escape | Allowlisted bucket and prefix, immutable version/ETag evidence. |
| Archive or parser bomb | Compressed and expanded byte, entry and time budgets. |
| False identity merge | Deterministic alias registry; ambiguity requires review. |
| Source poisoning | Separate confidence, authority and corroboration; preserve provenance. |
| Graph explosion | Node, relation, fan-out and proposal budgets. |
| Self-reinforcing learning | Replay, canary, independent evidence and rollback. |
| Privilege escalation | An envelope cannot change itself, protected strata, authority or capabilities. |
| Evidence deletion | Append-only promotion receipts and non-destructive tombstones. |
| Crash during promotion | Lease, digest CAS, temporary write, atomic rename and readback. |

## Security Boundary

Connector configuration contains a connection alias, never a secret value.
Source providers are read-only. External writes use the existing governed
Runtime and deployment-specific Ops gates.

## Release Blockers

- any critical or high unresolved finding;
- secret leakage in public or generated artifacts;
- protected-state auto-promotion;
- silent conflict resolution;
- effectful Program promotion without approval;
- non-recoverable adaptive write.
