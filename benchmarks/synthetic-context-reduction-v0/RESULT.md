# Synthetic Context-Reduction Benchmark Result

Status: reproducibility smoke test

## Command

Run from this directory:

```bash
node scripts/calculate-context-reduction.js
```

## Output

```json
{
  "schema_version": "0.1.0",
  "task_id": "task.notify_after_approval",
  "baseline_context_units": 620,
  "graph_context_units": 270,
  "total_reduction_percent": 56.4516,
  "note": "Synthetic demonstration only; do not merge with internal empirical metrics."
}
```

## Verdict

`pass_with_limitations`

The benchmark reproduces the expected arithmetic calculation for the synthetic
context-reduction example.

## Interpretation

This result shows that the public synthetic package is executable and that its
stored metric inputs reproduce the documented reduction value.

It does not show:

- semantic completeness;
- external validity;
- real-world task performance;
- agent safety;
- superiority over other methods.

## Next Improvements

- Add more synthetic tasks.
- Add deterministic context-unit counting.
- Add semantic-completeness review rubrics.
- Add negative examples.
- Add a benchmark runner that writes machine-readable result files.
