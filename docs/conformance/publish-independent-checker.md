# Publish The Independent Checker

Status: published and cross-platform verified

The independent Python checker is published at
`https://github.com/zabarov/mirai-conformance` and bound to revision
`ca5ee98d6a3d83b41f6379a521f7f4c000e381c8`. It does not import the
TypeScript Runtime. GitHub Actions run `33561590093` passed on Linux, macOS and
Windows, built the Python distributions and reproduced all 13 shared corpus
cases. A clean public clone also passed the checker tests and corpus locally.

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

`publication_status=published` closes only the public independent-conformance
gate. It does not replace human scientific review, security review or
production authorization.
