# Mirai Retrieval Minimal

Status: Mirai 2.4 alpha fixture

This fixture demonstrates an authorization-bound, rebuildable local index. The
source remains authoritative; `.mirai/indexes/` is disposable derived state.

```bash
mirai index plan examples/mirai-retrieval-minimal
mirai index build examples/mirai-retrieval-minimal
mirai search examples/mirai-retrieval-minimal "What is required for release?"
mirai search explain examples/mirai-retrieval-minimal "release policy"
```

The semantic provider is intentionally not installed by this fixture. Search
therefore reports degraded mode and uses exact and lexical channels without
pretending that lexical matches are semantic matches.
