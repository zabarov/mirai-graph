# Mirai 2.5 Controlled Model Pilot v2

Status: complete; eligible for RC engineering review

This package reruns the public-safe 12-case evaluation against the hardened
Outcome Completion contract. The protocol, executable generator, scorer,
validator and reviewer prompt are committed before any provider call.

The comparison measures complete information packages. It does not isolate a
single causal mechanism, prove universal effectiveness or authorize production
effects. AI-assisted condition-blind review is not external human review.

Execution is limited to the three declared generation models, one run per
cell, the declared reviewer model, and USD 5 total provider spend.

## Result

- 108 generation runs and 36 condition-blind AI review groups completed;
- zero active provider failures;
- provider spend: USD 0.7510 for this v2 run;
- Outcome Completion exact-status rate: 1.000;
- Outcome Completion outcome-integrity score: 0.931;
- false-completion rate: 0 in all three conditions;
- Outcome Completion reduced unnecessary clarification to 0.111, compared
  with 0.361 for application-only and 0.389 for retrieval-only;
- strict evidence-reference failures remain: 5 of 36 Outcome Completion runs,
  concentrated in the weaker-model cells.

These results support RC engineering review, not stable production acceptance.
They compare complete condition packages on a frozen synthetic corpus and do
not isolate one causal mechanism. The reviewer was an AI model, not an external
human assessor.
