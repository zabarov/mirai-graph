# Mirai Source Connectors

Official Mirai 2.2 source adapters are read-only. They discover and snapshot
external sources; they never perform external writes.

- `@zabarov/mirai-source-http` uses the built-in HTTP provider with host
  allowlists, DNS/private-address checks, redirect limits and size budgets.
- `@zabarov/mirai-source-postgres` and `@zabarov/mirai-source-mysql` provide
  bounded clients that open read-only transactions and accept only predefined
  query templates. Hosts may still inject their own client implementing the
  same `read_only=true` contract.
- `@zabarov/mirai-source-s3` provides an AWS SDK client for S3-compatible
  storage and enforces allowlisted bucket/prefix and object-size boundaries.
  A compatible host-supplied read-only client remains supported.

Credentials remain in Access Center or another host-local secret store. A
Mirai Source Descriptor contains only `connection_ref`, never a secret value.
Portal, MCP, Redis and arbitrary API integrations implement the same public
provider contract after the contract freeze.

The repository integration suite runs all four official adapters against a
real public HTTP endpoint and isolated PostgreSQL, MySQL and S3-compatible
containers. Container setup may write synthetic fixtures; the connector APIs
used by Mirai remain read-only.
