# Mirai Conformance Corpus

Status: `2.0.0-alpha.2` reference corpus

The corpus contains portable programs, inputs and expected outcomes. The
TypeScript runtime and the independent Python checker must evaluate the same
files. A disagreement blocks release promotion.

```bash
mirai conformance run conformance/corpus/pure/corpus.json
```

Corpus success proves agreement with the bounded fixtures only. It does not
prove project correctness, runtime authorization or broad AI quality.
