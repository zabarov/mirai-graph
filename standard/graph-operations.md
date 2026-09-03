# Graph Operations and Governed Organization

Status: Mirai 2.3 development contract; not a production readiness claim.

Mirai organizes shared references rather than duplicating their owner sources.
A knowledge view, a responsibility boundary and an execution team are distinct.
Membership in a view never grants access, ownership or execution authority.

## Operation boundary

`@zabarov/mirai/stdlib` provides versioned, typed operations. A pure operation
accepts an already authorized immutable snapshot and returns a value. Reading
the filesystem, invoking a model, dispatching work and persisting a receipt are
not pure operations. Unknown operations, versions and bindings fail closed.

The first catalog contains graph.query, graph.traverse, graph.project,
graph.diff, graph.draft, graph.propose_patch, relation.propose, graph.validate,
cluster.propose, cluster.evaluate, cluster.materialize_view, component.describe
and component.resolve. Component operations reuse the existing component
validator and contextual resolver.
Task operations are a separate governed extension, not arbitrary callbacks
registered by graph content. No new control-flow node is required.

Old Program 1.0.0 behavior and digests remain unchanged. Pure catalog operations
can be called through the existing pure adapter mechanism. Development Program
1.1 pins a catalog digest and natively dispatches its pure operations. Literal
arguments, required names and effects are checked at compilation; dynamic
values undergo full schema checks at the call boundary. This is not a complete
static proof for dynamic record types. Governed delegation uses the separate
`mirai_tasks` adapter, exact plan/registry binding, capabilities and signed
approvals. No task or inference effect can be disguised as `pure`.
Program 1.1, capability/approval 1.2 and effect receipt 1.1 opt into these effects;
legacy defaults and Program 1.0 remain valid. See the
[bridge contract](../docs/architecture/mirai-task-runtime-bridge.md).

## Snapshot and source boundaries

Objects have stable IDs, kinds, bounded scalar/list metadata, and source refs.
Source refs carry an owner reference, version digest and classification, not
document bodies. Relation facts preserve participants, roles, qualifiers,
scope, time bounds, authority, confidence and provenance. A binary relation is
projected as a two-participant fact without discarding its meaning.

Host code filters the graph using exact authorized object/source IDs before
giving data to an untrusted worker or model. Filtering requires a verified host
authorization boundary; a list declared inside a graph is not authorization.
An unauthorized participant excludes its entire relation fact. No dangling
relations or explanations may disclose excluded IDs, counts or source paths.
Graph content is never evaluated as code. Traversal is bounded and returns a
blocking budget diagnostic rather than silently treating truncation as complete.

Queries use exact metadata filters, explicit seeds, relation types and scopes.
There is no arbitrary query string, regex execution, remote path following or
implicit source loading. Canonical sorting uses JavaScript UTF-16 ordering, not
host locale; identifiers are restricted to ASCII.
Duplicate IDs, invalid refs, invalid time bounds and non-finite metadata
are rejected. All outputs are tied to their immutable input digest.

## Changes and clustering

Draft and patch operations only produce proposals. Patches carry the base
digest and explicit upsert/deprecate operations; conflicting or unknown targets
fail. They cannot modify authority, capabilities, policy or source owners.
Applying a proposal belongs to existing approved promotion/transaction APIs.

Rule clustering uses caller-selected metadata keys with exact values and
bounded relation neighborhoods. Membership may overlap. Ungrouped and ambiguous
objects stay visible for review. Cluster identity is based on rule/key/scope;
membership changes update a revision digest, not that identity.

A model provider returns candidate groups and explanations only from the
authorized input. Provider output is untrusted: validate schema, references,
membership budgets and evidence before inclusion. Record provider identity,
input/output digests and a replay result; identical live inference is not
promised. No silent fallback from unavailable inference to invented clusters.
Views remain ephemeral by default. Persisted derived navigation requires an
existing host-approved autonomy envelope; membership never changes that envelope.

## Delegation and acceptance

Each task has a root/parent, outcome contract, receiver binding, immutable input
and program/catalog/policy digests, deadline and budget reservation. The host
must supply all budgets explicitly; a recommended starter is one delegation
level, four simultaneous workers and sixteen tasks. Hard library ceilings are
eight levels, sixteen workers and 256 tasks. One durable task has one parent; shared
knowledge and result references do not duplicate work or create extra parents.

Task states are submitted, running, blocked, completed, failed and cancelled.
Acceptance is independent: pending, accepted or rejected. Completion means a
result was returned, not that its business outcome is correct. Acceptance binds
the exact result digest, required evidence and a host-authorized reviewer other
than the executor. Downstream tasks declare whether verified or accepted inputs
are required. The parent cannot close while required acceptance is missing.

Child authority is the intersection of the parent delegation scope and receiver
policy; it is never a copied grant. Root-wide budgets are reserved atomically.
Uncertain effects require reconciliation, not automatic retry. Replay consumes
recorded outputs without dispatch or inference. Active plans never change when
clusters or source files change. Conflicting writes remain isolated proposals.

The standalone TaskHost authenticates decisions through a trusted host callback;
its Program bridge uses the existing capability provider and approval mechanism.
A record hash is integrity metadata, not a signature. TaskLedger 1.2 records
ordered transitions and state in one CAS update. Chronological replay checks
that order, budgets and dependencies; legacy logical replay deliberately omits
completion-order differences. Neither proves reviewer authenticity, external
evidence truth or wall-clock history. An in-process
provider may ignore cancellation; the host stops waiting and marks uncertainty,
but cannot terminate arbitrary provider code. Production adapters need isolation.

Pure task receivers can use an immutable closure of at most 64 imported
Programs. Each reference must match its program digest; missing, unused,
effectful or alias-conflicting imports fail before dispatch. Calls share the
existing interpreter budgets. This does not add a second interpreter.

TaskHost executes independent ready tasks concurrently under one root budget.
The existing activation runner also executes frontiers concurrently and accepts
explicit trusted host adapters, still through capabilities. It rejects task
adapters: separate activation path runs must not multiply a shared task budget.
Use TaskHost for shared-budget task fan-out. Ordinary Program `parallel` retains
its existing serial reference interpretation; no Program-level speedup is claimed.

See [development usage and remaining gates](../docs/adoption/graph-organization-development.md).

## Frozen local pilot

Use public synthetic sources for two clients and three specializations:
requirements, verification and safety. Include shared refs, overlapping topics,
an unreadable source, an orphan, contradictory assertions and an ambiguous
receiver. A fixed oracle declares expected membership, blocked cases, required
dependencies and expected task outputs before implementation.

Compare manual assignment, explicit 2.2 Program and graph-resolved 2.3 using the
same inputs and deterministic/mock workers. Report exact required coverage,
wrong assignments, duplicate work, acceptance completeness and coordination
cost. Record simulation versus actual execution honestly. Mock inference proves
integration, not model quality. No scientific speed/accuracy claim is inferred
from synthetic scheduling or from a passing schema validator.
