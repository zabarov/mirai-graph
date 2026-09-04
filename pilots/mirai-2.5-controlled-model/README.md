# Mirai 2.5 Controlled Model Pilot

Status: completed exploratory public-safe engineering pilot; superseded as an RC gate by v2

This package records the frozen 12-case, three-condition, three-generation-model
pilot used to evaluate Outcome Completion. It contains 108 generation runs and
36 condition-blind AI review groups. No production effect or canonical write
was allowed.

## Conditions

- `application_only`: the model receives the task and admitted evidence.
- `retrieval_only`: the model receives task-scoped retrieval material.
- `outcome_completion`: the model receives a frozen Outcome Completion packet.

Generation models were `gpt-5.6-luna`, `gpt-5.6-terra`, and
`gpt-4o-2024-08-06`. The condition-blind AI reviewer was `gpt-5.6-sol`.

## Result

Outcome Completion improved exact status classification to `0.972` and the
deterministic outcome-integrity score to `0.908` on this corpus. It did not
eliminate strict evidence-binding failures: four of 36 Outcome Completion runs
failed that hard check. The result is retained as exploratory history. It does
not by itself pass the controlled-pilot RC gate because the executable scorer
and complete review bindings were not frozen in the same public lineage before
execution.

Provider cost was USD `0.7183`, below the approved USD `5` cap. The raw result,
analysis, frozen packets, preregistration, and digests are committed together so
the evaluation can be audited without provider credentials.

## Boundaries

- AI-assisted blinded review is not external human review.
- The corpus is synthetic and public-safe.
- The pilot does not test a production channel or authorize live effects.
- Model outputs are evidence, not canonical Mirai state.

Run `npm run validate:mirai-2.5-model-pilot` from the repository root.
