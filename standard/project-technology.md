# Project Technology

Status: 1.4 stable standard; activation contract remains 1.0.0

Project Technology is the shared executable mechanism of Mirai Graph. It is
not a profile, a second graph or a source of domain methodology.

## One Mechanism, Different Graphs

### Archived providers (unreleased compatibility extension)

The normal source provider path continues to verify Git HEAD and ancestry.
For an immutable distribution, `connect` also accepts `providerArchive` in the
JavaScript options, or `--provider-archive-trust <file>` in the CLI:

```json
{
  "exportSha256": "<SHA-256 of the exact bounded export bytes>",
  "graphId": "example.provider",
  "providerRevision": "<exact 40-character source revision>",
  "ancestorRevisions": ["<previous supported revision, proven during release build>"]
}
```

This is a **consumer trust input**, not provider self-authentication. The caller
must derive it from an authenticated release lock/manifest after checking its
integrity and issuer. Never calculate a hash from an untrusted download and
call that authentication. Mirai does not discover, download or trust adjacent
metadata automatically. Packaging must verify the export against the accepted
source target and the declared source revision before publishing its digest.
Ancestor entries must be proven by the source Git history during that build;
they are not inferred from version numbers, dates or commit hash ordering.

Exports produced by `provide` now include `provider_graph_id`. Old Git-backed
exports remain readable; archive import requires the graph identity. `connect`
uses the same full accepted execution contract validation and atomic import.
`--refresh-binding` still requires the same target and semantic/architecture
contract; a changed revision must explicitly descend from the current binding
in the authenticated release metadata. A wrong or incomplete anchor fails,
even when a working Git checkout happens to be available. The caller cannot
use archive trust to authorize work, change owners, expand scope or bypass
acceptance. `provide` continues to require the canonical Git source; archive
consumers import its immutable output, never regenerate acceptance from copies.

Status/verify use the hash-bound local import and remain read-only. Repository
snapshot inventory, raw-source access and release authenticity policy remain
separate responsibilities; archive import does not claim to solve them.

The root `graph.json` declares the repository scope and profiles. The same
Project Technology operations therefore work for:

- an ordinary project;
- a skill using `skill_runtime`;
- a technology platform;
- a federation or another multi-repository system.

Each graph keeps its own objects and relations. Project Technology only
standardizes safe inventory, task context, accepted-target binding, freshness
and verification.

## Executable Technologies And Course Projections

An executable technology is an accepted graph of reusable operations and
user-facing scenarios. It is suitable for a long method that has both an
end-to-end path and independently useful parts. Each operation binds its owner,
capability, prerequisites, inputs, outputs, checks, stop conditions, rollback
and exact raw source references.

A scenario names an outcome and selects the operations needed to reach it.
Project Technology calculates prerequisite closure, so a course or executor
cannot silently omit a required safety step.

```bash
mirai-graph technology course compile . --technology graph/specs/technology.json
mirai-graph technology course compile . --technology graph/specs/technology.json --scenario scenario.recovery
mirai-graph technology course verify . --course-pack course-pack.json
mirai-graph technology course reconcile . --course-pack course-pack.json --projection edited-course.json
```

The JavaScript API exposes `compileTechnologyCourse`,
`verifyTechnologyCourse` and `reconcileTechnologyCourse`.

A Course Pack is hash-bound to the normalized technology, chosen scenarios,
sources and revisions. It may be rendered into a document, learning system or
documentation site. It remains a projection: editorial changes may be routed
to the documentation owner, while changed prerequisites, owners, checks, stop
conditions, rollback or scope become semantic proposals. Reconciliation never
writes them into the accepted technology automatically.

## Immutable Artifact Releases

Project Technology can preserve versioned file bundles without turning their
contents into graph data:

```text
inspect -> release preview -> transactional release -> compare -> verify
```

The generic CLI is:

```bash
mirai-graph technology artifact inspect . --input incoming.zip
mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound
mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound --apply
mirai-graph technology artifact compare . --matter-id agreement-main --base-release 20260828-01 --target-release 20260828-02
mirai-graph technology artifact verify . --matter-id agreement-main --release-id 20260828-02
```

The programmatic API exposes `inspectArtifactBundle`,
`createArtifactRelease`, `compareArtifactReleases` and
`verifyArtifactRelease`.

Each immutable release keeps the original input, a normalized package, a
hash-bound manifest and a technical comparison. The portable registry at
`graph/specs/artifact-releases.json` stores only opaque matter/release ids,
relative or provider refs, lineage, state and digests. Raw files, document
contents, party names and private discussion remain in the protected artifact
store.

Direct files, directories, ZIP, TAR and TAR.GZ are supported. Unsafe paths,
links, encrypted archives, executable or macro-enabled files, nested archives,
normalized path collisions and configured archive limits fail closed. RAR and
7z need an explicitly supplied safe provider.

Creation uses a lease, compare-and-swap registry digest, temporary assembly,
atomic activation and readback. Repeating the same release returns
`changed=false`. Domain consumers own the meaning of release states; Mirai
Graph owns only generic identity, lineage, integrity and technical comparison.

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
- Artifact inspection, comparison and verification are read-only. Release
  creation is preview-only without `--apply`.
- An artifact manifest or generated export never proves legal, business or
  domain acceptance.
- A context pack is not ready while a required branch, source, access boundary
  or validator is missing, stale, blocked, deprecated, conflicting or
  digest-mismatched.
