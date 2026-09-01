# Mirai 2 Scientific Evaluation

Status: exploratory variance pilot complete; confirmatory evidence is not yet available

This package turns the scientific protocol into machine-readable release
evidence. `plan.json` defines the factors, domains, endpoints, randomization,
blinding and sample-size rule. `variance-pilot-result.json` records a
public-safe 144-cell exploratory calibration across twelve tasks, four model
snapshots and three control conditions. `power-analysis-readiness.json` records
the resulting task-cluster planning estimate.

```bash
npm run validate:mirai-scientific-evaluation
```

A green validation means the exploratory pilot and planning artifacts are
internally consistent. It does not mean the blinded review or held-out
confirmatory study has been completed, and it does not establish broad
effectiveness, model interchangeability or production safety.
