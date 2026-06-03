# Mirai Graph Limitations And Threats To Validity

Status: alpha limitation table

## Known Limitations

| Area | Limitation | Mitigation |
|---|---|---|
| Synthetic benchmarks | Public examples are simplified | Add more independent public-safe pilots |
| Context generation | Alpha generator uses simple matching and relation expansion | Add semantic review and baseline comparison |
| Validation | Validators check declared shape, not full truth | Keep evidence and reviewer checks separate |
| Readiness score | Score is a navigation signal | Do not use readiness as approval |
| Process control | State-machine validation can miss domain meaning | Require domain review and evidence |
| Scientific evidence | Current evidence is not peer-reviewed proof | Maintain protocols, limitations and reproducibility |
| External validity | Most examples are maintained by the project author | Add third-party or independently produced pilots |

## Threats To Validity

- Selection bias in chosen examples.
- Overfitting fixtures to current validators.
- Measuring context reduction without measuring missed dependencies.
- Treating public-safe simplification as real-world complexity.
- Treating AI-assisted review output as ground truth.
- Confusing governance conformance with operational safety.

## Required Claim Discipline

Allowed:

- "Mirai Graph alpha provides runnable schemas, validators and public-safe
  examples."
- "Synthetic benchmark results demonstrate the method on a controlled fixture."
- "Public pilots provide early applicability evidence."

Not allowed:

- "Mirai Graph is scientifically proven."
- "Mirai Graph is production-safe for autonomous execution."
- "Mirai Graph replaces human governance."
- "Generated context is canonical truth."
