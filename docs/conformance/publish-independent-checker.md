# Publish The Independent Checker

Status: publication-ready local package; remote not configured

The independent Python checker is implemented in a separate local repository
and bound to revision `598621df0a181785805ff46cbfa1e98f2510615f`. It does not
import the TypeScript Runtime. The intended public repository is
`https://github.com/zabarov/mirai-conformance`, but no remote is currently
configured, so the public-checker release gate remains blocked.

## Publication Boundary

Publishing requires a separate live GitHub approval and action gate. Before the
gate can be marked passed:

1. create or verify the public repository;
2. configure `origin` in the checker checkout;
3. push the exact bound revision without rewriting history;
4. run the Python checker CI from a clean public clone;
5. compare its results with the committed TypeScript corpus;
6. update `remote_verified` only from recorded public evidence.

The checker repository must not contain private paths, experiment credentials,
raw runtime receipts, approval signatures or customer data.

## Verification

```bash
npm run validate:independent-checker-publication
npm run validate:independent-conformance
npm run validate:independent-runtime-conformance
npm run validate:independent-graph-native-conformance
npm run validate:independent-project-conformance
```

`publication_status=local_only` is a valid honest state, but it does not close
the public-independent-checker gate.
