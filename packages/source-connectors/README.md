# Mirai Source Connectors

Official Mirai 2.2 source adapters are read-only. They discover and snapshot
external sources; they never perform external writes.

- `@zabarov/mirai-source-http` uses the built-in HTTP provider with host
  allowlists, DNS/private-address checks, redirect limits and size budgets.
- `@zabarov/mirai-source-postgres` and `@zabarov/mirai-source-mysql` accept a
  host-supplied read-only client plus predefined query templates. The adapter
  rejects mutation syntax and requires the client to attest `read_only=true`.
- `@zabarov/mirai-source-s3` accepts a host-supplied read-only S3 client and
  enforces allowlisted bucket/prefix boundaries.

Credentials remain in Access Center or another host-local secret store. A
Mirai Source Descriptor contains only `connection_ref`, never a secret value.
Portal, MCP, Redis and arbitrary API integrations implement the same public
provider contract after the contract freeze.
