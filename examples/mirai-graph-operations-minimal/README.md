# Overlapping Views of Shared Sources

Status: Mirai 2.3 development example; no production or scientific claim.

The same requirements are relevant to a requirements specialist and a safety
specialist. Both views refer to the same source digest. Group membership is not
ownership or permission. An unclassified object remains visible for review.

From a repository checkout after `npm run build`:

```sh
node packages/cli/mirai.js stdlib describe graph.query
node packages/cli/mirai.js graph query examples/mirai-graph-operations-minimal/query.json
node packages/cli/mirai.js cluster propose examples/mirai-graph-operations-minimal/cluster.json
```

These commands print values to stdout; they do not create a capsule, edit source
files or authorize changes. Input files are already host-filtered synthetic
snapshots. Access filtering must happen before a real snapshot is sent to a
worker. Querying a graph is not a substitute for source-system authorization.

`oracle.json` declares expected groups independently of the clustering output.
`expected-clusters.json` is a deterministic regression fixture. Neither is a
measurement of live model quality. Regenerate with
`npm run generate:graph-operation-fixtures`; verify with the same script and
`--check`. Task delegation and distributed operation are not demonstrated here.
