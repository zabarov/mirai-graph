# Project Technology

Status: 1.0 release-candidate extension contract

Project Technology is the shared executable mechanism of Mirai Graph. It is
not a profile, a second graph or a source of domain methodology.

## One Mechanism, Different Graphs

The root `graph.json` declares the repository scope and profiles. The same
Project Technology operations therefore work for:

- an ordinary project;
- a skill using `skill_runtime`;
- a technology platform;
- a federation or another multi-repository system.

Each graph keeps its own objects and relations. Project Technology only
standardizes safe inventory, task context, accepted-target binding, freshness
and verification.

## Public Contract

The only manifest extension key is `mirai.project_technology`:

```json
{
  "contract_version": "1.0.0",
  "enabled": true,
  "context_policy": "task_scoped",
  "source_boundary": "hybrid_sot"
}
```

Canonical graph objects remain in `graph/specs`. Exact external revisions
remain in `graph.lock.json`. Mutable local state is ignored under
`.mirai-graph/project-technology/`.

The only generated provider artifact is:

```text
graph/generated/project-technology/target-provider-export.json
```

It contains target identity, exact provider revision, decision and goal
references, Done When, requirements and acceptance references, constraints,
non-goals, deferred boundaries, approved repository/owner/package/file/action
scope, the accepted architecture boundary and a contract digest.

## Hybrid Source Of Truth

Project Technology may select graph objects and point to raw sources. It must
not copy private source, complete documents, code or long owner methodology
into the graph or provider export.

The graph answers "what applies and where is the authority?". The raw owner
source still answers "how should the domain work be done?".

## Safety Rules

- Read-only commands never write.
- Changing commands return preview unless `--apply` is explicit.
- Significant work fails closed when the target binding is missing, stale,
  disabled, conflicting, incomplete or tampered.
- Refresh-binding accepts only a forward provider revision with the same target,
  semantic digest and complete execution-contract digest.
- Repeated sync, connect or refresh produces `changed=false` when nothing
  changed.
- A blocked repository still supports narrow `explain`, `status`, `plan` and
  diagnostic `verify` calls.
