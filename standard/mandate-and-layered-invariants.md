# Mandate and Layered Invariants

Status: additive Mirai 2 development contract

## Purpose

A valid Program and a matching capability rule are not sufficient authority to
act. An autonomy-enabled host can require two additional checks before issuing
a capability grant:

1. an exact, host-signed mandate for the run and request scope;
2. evaluation of applicable system, organization, program, project and task
   invariants.

The feature is opt-in for backward compatibility. Existing Mirai 2 Programs
continue to use the original capability policy unless the host supplies an
authorization context.

## Mandate Boundary

A mandate is host-local and HMAC-signed. It binds subject, issuer, run, Program
digest, input digest, policy digest, exact capability request scopes and an
expiry. Revoked, expired, forged or scope-mismatched mandates fail closed.

Graph content, Program content, generated context and evidence cannot create a
valid mandate because they do not have access to the host-local signing key.
The mandate itself still does not authorize canonical graph updates.

## Layered Invariants

Invariant rules can be attached to five authority layers:

```text
system -> organization -> program -> project -> task
```

Evaluation is restrictive: every applicable deny blocks the request. A lower
layer allow can never weaken a higher-layer deny, and a malformed invariant set
also denies. An optional host policy may require at least one applicable
invariant rule.

Invariant evaluation produces digest-bound evidence referenced by the policy
decision and grant. It does not replace the capability allowlist, mandate or
approval receipt.

## Decision Order

```text
capability request
-> mandate verification
-> layered invariant evaluation
-> host capability allowlist
-> apply/approval verification when required
-> capability grant or fail-closed decision
```

All stages are required when enabled. Passing one stage cannot bypass another.
