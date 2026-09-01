# Mirai Security Policy

## Supported Security Scope

The `2.0.0-alpha.x` line is a development release. It is supported for
read-only discovery, validation, simulation and governed sandbox evaluation.
It is not approved for unrestricted production writes, network effects,
financial actions, secret rotation or public publishing.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting for
`https://github.com/zabarov/mirai-graph`. Do not open a public issue containing
an exploit, secret, approval receipt, capability token, customer trace or
private path.

Include the affected revision, contract or adapter, reproduction steps,
expected boundary, observed behavior and a minimal sanitized fixture. Reports
should state whether the finding can cross a sandbox, capability, approval,
path, evidence-redaction or canonical-write boundary.

## Response Boundary

Security reports do not authorize live reproduction. Maintainers first create
a bounded local fixture, classify severity and affected contracts, then add a
regression test and evidence before changing readiness metadata.

Automated dependency and CodeQL checks are supporting evidence only. The
independent security-review gate requires a reviewer who did not implement the
reviewed Runtime changes.
