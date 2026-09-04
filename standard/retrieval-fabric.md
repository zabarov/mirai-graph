# Mirai Retrieval Fabric

Status: Mirai 2.4 alpha core extension

## Purpose

Retrieval Fabric finds authorized facts, relations, technologies, policies,
evidence and programs without turning Mirai into a second source of truth.

```text
request or event
-> intent hypothesis
-> authorization and scope
-> retrieval plan
-> exact + lexical + semantic + graph + process channels
-> rank fusion and graph-aware reranking
-> authority, freshness and conflict checks
-> evidence-bound answer
-> safe next action
```

## Data Boundary

Owner systems keep complete documents and records. `mirai/retrieval.yaml` is
portable configuration. `.mirai/indexes/` contains a minimal, disposable
projection: tokens, optional embeddings, bounded snippets, metadata, source
and graph references, authority, freshness and snapshot digests.

Confidential and restricted sources are `reference_only` unless an explicit
data-placement policy authorizes more. Credentials are never index content.
Deleting and rebuilding an index cannot change canonical graph state.

## Authorization First

Authorization filtering happens before index insertion and again before a
query. A request is bound to principal, purpose, scopes, source references and
policy digest. A changed access projection requires a separate index. Search
results cannot grant approval, capabilities, execution or canonical writes.

## Search Semantics

Providers return ranked lists independently. Mirai combines them using
Reciprocal Rank Fusion instead of comparing incompatible provider scores.
Semantic retrieval is an explicit provider capability. If unavailable, the
answer reports degraded mode; lexical search is not relabeled as semantic.

Every answer claim carries evidence references. Missing, stale or conflicting
evidence causes clarification, a partial answer or abstention.

## Federation

Each graph keeps its index locally. A federated directory exposes only domain,
intent, authority, freshness, endpoint alias and query contract metadata.
Remote owners perform local retrieval and return sanitized, digest-bound
evidence. Effective access is the intersection of requester grant, delegation
scope, remote policy, source ACL and purpose. Deny wins.

Federated envelopes carry visited graph ids, hop and fan-out limits, deadline,
cost and token budgets. Cycles and repeated graph visits fail closed. A remote
network request is a governed runtime effect with a receipt; local search over
an immutable index snapshot is pure.

Remote dispatch uses deadline-bounded calls. A timeout is returned as an
explicit partial result, never as a complete answer. Optional in-memory caching
is keyed by the full query envelope plus responder graph, index, graph and
policy digests; TTL expiry or graph invalidation removes the entry. A cache hit
cannot widen scope or survive a snapshot change.
