# Observable Self-Correcting AI Workflows

Status: article foundation

## Working Title

Observable Self-Correcting AI Workflows with Dynamic Episode Traces and
Technology Quality Feedback

## Core Question

Can a graph-governed workflow make AI-assisted work auditable and
self-improving by recording what actually happened, checking whether the
declared technology was followed and routing findings into correction,
replay/regression or Kaizen?

## Proposed Contribution

The article introduces an observable correction loop:

```text
process contract
-> dynamic episode trace
-> technology quality feedback
-> finding classification
-> correction route
-> Kaizen / replay / regression candidate
```

The loop separates planned technology from actual behavior. It records why a
path was selected, why alternatives were blocked, which gates were evaluated,
what result was produced and how findings should be handled.

## Hypotheses

- H1. Dynamic episode traces improve auditability by preserving selected paths,
  blocked alternatives, gates, evidence and limitations.
- H2. Technology quality feedback identifies process violations that ordinary
  test results can miss.
- H3. Classified findings with correction routes improve recurrence prevention
  by feeding Kaizen and replay/regression candidates.

## Public Artifacts

- `standard/dynamic-episode-layer.md`
- `standard/episode-trace.md`
- `standard/dynamic-layer-code-generation.md`
- `schemas/dynamic-episode-trace.schema.json`
- `examples/dynamic-episode-minimal/`
- `standard/technology-quality-feedback.md`
- `schemas/technology-quality-feedback.schema.json`
- `examples/technology-quality-feedback-minimal/`
- `standard/process-control-contract.md`
- `releases/1.0.0-rc.4.md`
- `releases/1.0.0-rc.6.md`

## Experiment Design

Compare ordinary AI-assisted execution with observable graph-controlled
execution.

Baseline:

```text
task -> work output -> tests/review
```

Graph-controlled condition:

```text
task
-> process contract
-> episode trace
-> selected and blocked paths
-> technology feedback report
-> classified findings
-> correction route / Kaizen / replay candidate
```

## Candidate Metrics

- episode trace completeness;
- blocked-alternative coverage;
- technology-step adherence;
- unclassified finding count;
- tests-passed-but-process-violated count;
- correction-route coverage;
- repeat-failure rate after Kaizen;
- replay/regression pass rate;
- reviewer effort to reconstruct what happened.

## Required Evidence Before Publication

- Sanitized private or public pilot traces.
- At least one replay/regression run over corrected workflow behavior.
- Reviewer packet showing whether an external reviewer can reconstruct why the
  AI acted as it did.
- Threats-to-validity section covering task difficulty, model variance,
  selection bias, retention policy and trace privacy.

## Limitations

Current public artifacts validate trace and feedback shape. They do not prove
that production AI work becomes safe, autonomous or objectively better without
pilot evidence and independent review.
