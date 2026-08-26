# Project Technology Context Traversal

This synthetic example shows a domain-neutral release graph with a three-level
path, mandatory rollback and validation dependencies, and one optional branch.

Start with discovery:

```bash
mirai-graph technology context . --phase discover --task "prepare and verify a release"
```

Save the returned `traversal_receipt`, expand the selected capability and
process, then copy the returned task and graph digests into
`selection.example.json`. Compilation adds the rollback constraint and release
smoke even if the selector did not name them.

All operations are read-only. The example contains synthetic public data only.
