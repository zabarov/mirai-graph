# Mirai 2 Scientific Evaluation

Status: preregistration package; effectiveness evidence is not yet available

This package turns the scientific protocol into machine-readable release
evidence. `plan.json` freezes the factors, domains, endpoints, randomization,
blinding and sample-size rule. `power-analysis-readiness.json` records why the
current three engineering fixtures cannot yet determine a confirmatory sample
size.

```bash
npm run validate:mirai-scientific-evaluation
```

A green validation means the research boundary is explicit. It does not mean
that the experiment has been run or that Mirai 2 outperforms either baseline.
