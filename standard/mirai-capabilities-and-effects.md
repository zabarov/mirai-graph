# Mirai Capabilities And Effects

Status: `2.1.0-rc.1` frozen reference contract

## Purpose

A Mirai Program may declare that a node needs an external effect. That
declaration is a request, not authority. Mirai Runtime executes the operation
only when a host policy accepts the request and issues an opaque capability
grant for the exact run and node.

```text
program effect declaration
-> capability request
-> host policy decision
-> optional human approval verification
-> opaque capability grant
-> adapter execution
-> durable receipt and verification
```

Graph content, generated context, an earlier episode, evidence, a proposal or
the Program itself cannot mint a grant.

## Capability Binding

A grant and any required approval are bound to:

- run, Program digest, input digest and node;
- evaluated argument digest;
- adapter, operation, resource and declared effect;
- call, byte and time budgets;
- policy digest and expiry;
- an approval receipt when the policy requires one.

Cross-run reuse, expired grants, changed arguments, changed resources and
forged approvals fail closed. Grants and approvals remain host-local and are
not part of a portable graph package.

## Reference Adapters

The alpha.3 runtime contains a deliberately small adapter set:

- `repository.read` and `repository.list` inside the sandbox;
- `git.status` and `git.diff` for read-only repository inspection;
- `workspace.write_file` with path, symlink and expected-content guards;
- `test.run` for a host-defined allowlisted command, without a shell;
- `human.require_approval` for an explicit approval boundary.

Workspace writes and test commands require `--apply` and a signed host-local
approval receipt. A program can select only a preconfigured test command id;
it cannot supply an executable, shell expression or inherited secret-bearing
environment.

Network, production, secret-changing, financial and public-publishing adapters
are not part of core Mirai 2.0. A future adapter must define its policy,
verification, idempotency, compensation, secret handling and evidence
boundaries before it can enter conformance review.

## Safety Properties

- repository and workspace paths cannot escape the sandbox or traverse a
  symbolic link;
- effects must match the Program declaration and adapter contract;
- host policy may deny an otherwise valid Program;
- approval is scoped to the exact run, Program, input, policy, evaluated arguments,
  node, adapter, operation, resource, effects and budgets;
- adapter results do not authorize another effect;
- canonical graph updates require a separate approved proposal path.

See [Durable Execution](mirai-durable-execution.md) for receipts, recovery and
replay behavior.
