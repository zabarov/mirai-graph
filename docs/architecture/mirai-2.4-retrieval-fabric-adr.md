# ADR: Mirai 2.4 Retrieval Fabric

Status: accepted for 2.4 alpha implementation

## Decision

Mirai adds Retrieval Fabric as a core extension rather than a domain profile.
It uses rebuildable local projections, authorization-before-retrieval,
evidence-bound answers and owner-local federation.

## Consequences

- Hybrid SOT is preserved; indexes never become canonical sources.
- Equal source/configuration snapshots produce equal descriptor digests.
- Semantic search is optional and its absence is visible.
- Active queries are bound to immutable index, graph and policy digests.
- Full cross-graph replication and automatic authority inheritance are banned.
- Search may recommend a Mirai Program but cannot execute or approve it.

## Rejected Alternatives

- A central global vector database: breaks data ownership and tenancy bounds.
- Storing complete source documents in the graph: duplicates owner systems.
- LLM-only retrieval planning: not deterministic or independently conformable.
- Silent lexical fallback for semantic search: creates false capability claims.
- Live graph traversal during long-running execution: breaks snapshot binding.
