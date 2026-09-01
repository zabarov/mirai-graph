# Connect A Project With Mirai Project Capsule

Status: Mirai 2.1 development tutorial

## 1. Detect

Detection is read-only:

```bash
mirai project detect . --markdown
```

It reports one of `current`, `needs_compile`, `legacy_detected`,
`dual_root_conflict`, `bootstrap_proposal` or `invalid`.

## 2. Prepare A Proposal

For a project without Mirai, create a local proposal without changing
canonical project state:

```bash
mirai bootstrap . --mode suggest --profile software_specification
```

The proposal is written to `.mirai/proposals/bootstrap-proposal.json` and has
`canonical_write_allowed=false`.

## 3. Initialize

After choosing the boundary and profile:

```bash
mirai project init . --profile software_specification
mirai project validate .
```

This creates `mirai/`, a generated root `graph.json` compatibility facade and
a `.gitignore` entry for `.mirai/`. It does not create a second `graph/` data
tree.

## 4. Handshake With An Agent

Before a significant task, obtain the compact execution brief:

```bash
mirai project inspect . --for-agent --task "implement the approved feature"
```

The brief identifies required sources, available programs, policies, missing
context, forbidden actions and the next safe step. It cannot grant approval.

## 5. Edit And Recompile

Edit `mirai/manifest.yaml` or `mirai/owner-notes.md`, then regenerate the
machine contract and start page:

```bash
mirai project compile .
mirai project validate .
```

Any changed graph, program, component, policy, interface, context or source
catalog entry makes the old lock stale until compilation succeeds.

## Legacy Migration

Always inspect a dry-run first:

```bash
mirai project migrate . --from graph-v2 --dry-run
```

Apply is a separate owner-approved operation:

```bash
mirai project migrate . --from graph-v2 --apply --approval <receipt.json>
```

The migration preserves graph bytes, records digests and rollback instructions,
moves portable data to `mirai/graph/` and regenerates the root facade. A file
move alone is not proof of semantic equivalence; validate project context and
technology selection after migration.
