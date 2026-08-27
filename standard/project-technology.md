# Project Technology

Status: 1.2 stable standard; activation contract remains 1.0.0

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

## Portable Project Continuity

Project Technology preserves verified project experience at task boundaries:

```text
task context -> verified outcome -> semantic candidate -> graph/specs
             -> next task context -> usage verification
```

`graph/specs` is the portable authority. Chat history and local workflow files
are not required by another person or installation. Mutable receipts and
rollback data are stored outside the project in a host-local directory keyed by
`graph.id`.

The existing `sync` operation accepts `task_start`, `stage_complete` and
`task_complete`. Task start is read-only. A completed stage or task requires a
verified, requirement-bound input and records accepted evidence plus one
reusable regression case. New goals, architectural decisions and ownership
changes remain proposals.

Two independent verified cases with the same signature may promote a method
lesson when they do not change architecture. Repeated input is byte-identical
and returns `changed=false`. Shared folders without Git additionally use a
lease, compare-and-swap graph digest, backup, atomic write and readback.

## Sequential Context Traversal

Project Technology exposes one model-independent navigation protocol:

```text
discover -> expand -> compile -> verify
```

- `discover` ranks a bounded set of top-level candidates for a task.
- `expand` reveals the accepted children of one or more selected nodes.
- `compile` validates the client's structured selection and adds the mandatory
  closure over `requires`, `governed_by` and `validated_by`.
- `verify` checks that the resulting sources and rules were connected to a
  decision, a surface, a validator and an outcome.

The caller may be a human, an AI model or a deterministic rule. Mirai Graph
does not select or invoke a model. Sequential and batched expansion of the same
nodes produces the same receipt digest.

The universal relation vocabulary for traversal is:

- structure: `contains`, `specializes`;
- mandatory closure: `requires`, `governed_by`, `validated_by`;
- sources: `documented_by`, `implemented_by`;
- interaction: `hands_off_to`, `conflicts_with`.

Consumer-specific names such as skills, companions or product commands are not
part of this protocol. Consumers map their own domain vocabulary to ordinary
owners, roles, capabilities, processes, resources, checks and access
requirements.

## Public Contract

The only manifest extension key is `mirai.project_technology`:

```json
{
  "contract_version": "1.0.0",
  "enabled": true,
  "context_policy": "task_scoped",
  "source_boundary": "hybrid_sot",
  "continuity_policy": "task_boundary"
}
```

Canonical graph objects remain in `graph/specs`. Exact external revisions
remain in `graph.lock.json`. Mutable continuity state is host-local and keyed
by graph identity; project-local runtime directories are not continuity
authority.

The only generated provider artifact is:

```text
graph/generated/project-technology/target-provider-export.json
```

It contains target identity, exact provider revision, decision and goal
references, Done When, requirements and acceptance references, constraints,
non-goals, deferred boundaries, approved repository/owner/package/file/action
scope, the accepted architecture boundary and a contract digest.

The architecture boundary carries exact component, package and capability
identities, ownership for data/access/lifecycle/interface/runtime, required and
forbidden relations, and dependency constraints. This keeps an imported target
executable without copying the provider's private source or full graph.

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
- Context traversal is read-only in every phase and never grants write
  authority.
- Chat text, secrets, private source, user paths and unverified assumptions are
  rejected from portable continuity.
- Significant work with an enabled continuity policy fails closed when its
  terminal receipt is missing or stale.
- A context pack is not ready while a required branch, source, access boundary
  or validator is missing, stale, blocked, deprecated, conflicting or
  digest-mismatched.
