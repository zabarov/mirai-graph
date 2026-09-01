# Mirai Conformance Corpus

Status: `2.0.0-alpha.3` reference and independent evidence corpus

The corpus contains portable programs, inputs and expected outcomes. The
TypeScript runtime and the independent Python checker must evaluate the same
files. A disagreement blocks release promotion.

```bash
mirai conformance run conformance/corpus/pure/corpus.json
```

Corpus success proves agreement with the bounded fixtures only. It does not
prove project correctness, runtime authorization or broad AI quality.

The independent Python checker also validates committed pilot episodes and
sanitized governed-runtime evidence. These results are stored in
`conformance/results/python-*-result.json` and are checked with:

```bash
npm run validate:independent-runtime-conformance
```

Runtime comparison excludes host-local effect payloads, capability grants and
approval signatures. The public result checks consistency, not authority.

Mirai 2.1 activation plans and run results are also checked by the independent
Python implementation. It recomputes graph bindings, dependency frontiers and
aggregate trace digests without importing the TypeScript runtime:

```bash
npm run validate:independent-graph-native-conformance
```
