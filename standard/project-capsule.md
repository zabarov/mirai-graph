# Mirai Project Capsule

Status: Mirai 2.1 development contract

## Purpose

A Project Capsule is the portable, self-describing control envelope of a
project, organization or AI system. It lets a human or agent discover the
Mirai and contract versions, graph entry points, programs, policies, source
boundaries and the next safe action without reading the whole repository.

```text
project sources
-> mirai/manifest.yaml
-> deterministic manifest.lock.json
-> generated START.md
-> task-scoped Agent Execution Brief
-> governed process selection
```

The capsule is core infrastructure, not a domain profile. It does not replace
Mirai Graph Core, Mirai Program or Mirai Runtime.

## Portable And Local State

Portable, reviewable state lives under `mirai/`:

```text
mirai/
  manifest.yaml
  manifest.lock.json
  START.md
  owner-notes.md
  graph/
  programs/
  components/
  policies/
  interfaces/
  context/
  sources.yaml
  migrations/
  proposals/
```

Host-local runtime state lives under `.mirai/` and is gitignored. It includes
caches, runs, checkpoints, receipts, evidence and migration backups.

The root `graph.json` is a generated compatibility facade throughout Mirai
2.x. It points to `mirai/graph/*`; it is not a second source of truth and does
not duplicate graph data.

## Manifest And Lock

`mirai/manifest.yaml` is the canonical authoring file. It declares project
identity, required contract versions, profiles, features, entry points,
documentation and safety boundaries. It cannot issue capabilities, approvals
or canonical-write permission.

`mirai/manifest.lock.json` is the deterministic machine contract. It contains
the normalized manifest, resolved contracts, entrypoint digests, semantic
source-reference digest and overall lock digest. YAML comments and formatting
do not change it. Runtime must reject a missing or stale lock.

`mirai/START.md` is generated from the verified lock and
`mirai/owner-notes.md`. Manual changes to generated content are detected as
drift.

## Discovery Precedence

```text
valid manifest + fresh lock -> current
manifest without fresh lock -> needs_compile; execution blocked
legacy graph.json/graph/ -> migration proposal
incompatible current and legacy roots -> dual_root_conflict
no Mirai layout -> bootstrap proposal
```

Read-only detection never creates a capsule. Bootstrap in `suggest` mode writes
only a local proposal. Migration apply requires explicit owner approval and
validated rollback evidence.

## Agent Execution Brief

`mirai project inspect --for-agent --task` returns only task-relevant project
identity, contract versions, profiles, source references, available programs,
policies, allowed and forbidden actions, blockers and the next safe action.
It does not expose source contents, secret values, capability grants or hidden
runtime state.

## Boundaries

- Mirai remains Hybrid SOT; owner files, code, databases and portals retain
  detailed authority.
- Generated context, evidence, episodes and proposals are not authorization.
- Runtime executes against a verified immutable lock and immutable program or
  activation-plan digests.
- Knowledge assimilation, learning and migration remain proposal/approval
  first.
- Bulk content, secrets and raw runtime logs do not belong in `mirai/`.
