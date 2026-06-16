# Mirai Graph Playground Demo Report

Status: deterministic 1.0.0-rc.4 demo

## Control Loop

```text
seed -> graph -> context -> launch -> transition explanation -> cockpit -> traceability -> multi-source feedback -> evidence -> kaizen -> baseline comparison
```

## Demo Inputs

- Synthetic package: `benchmarks/synthetic-context-reduction-v0`
- Objects: `12`
- Relations: `8`
- Context pack: `context_pack.task_notify_after_approval`
- Launch record: `launch_record.synthetic_batch`
- Transition request: `transition_request.release_ready_to_released`
- Transition explanation: `transition_explanation.release_ready_to_released`
- Process-control contract: `process_control_contract.synthetic_executable_process`
- Development cockpit: `cockpit_report.synthetic_delivery`
- Feature traceability: `trace_report.synthetic_feature_delivery`
- Multi-source feedback: `feedback_report.synthetic_multi_source`
- Baseline comparison: `baseline_comparison.synthetic_notify_after_approval`

## Commands

```bash
npm run validate:minimal
npm run seed:preview
npm run context:generate
npm run validate:launch-record
npm run validate:process-transition
npm run validate:process-transition-report
npm run validate:process-control
npm run validate:instrumentation-layer
npm run validate:instrumentation-report
npm run validate:implementation-control-cycles
npm run validate:baseline-comparison
```

## Transition Explanation

- Requested transition: `release_ready -> released`
- Matched transition: `true`
- Required evidence: `release_evidence`
- Missing evidence: `0`
- Kaizen decision: `satisfied`

## Instrumentation

- Cockpit production readiness: `not_ready`
- Cockpit next action: `promote_to_review_ready_after_transition_validation`
- Feature mappings: `1`
- Evidence-backed mappings: `1`
- Multi-source feedback verdict: `accepted_for_transition`
- Blocking findings: `0`
- Kaizen refs: `kaizen.synthetic_traceability_checklist`

## Baseline Comparison

- Baseline context units: `620`
- Mirai Graph context units: `270`
- Context reduction: `56.4516%`
- Baseline missed dependencies: `2`
- Mirai Graph missed dependencies: `0`
- Verdict: `synthetic_mirai_graph_result_stronger_with_limits`

## What This Demonstrates

- Mirai Graph can validate a graph package.
- Mirai Graph can generate task-specific context from graph state.
- Launch records describe bounded work permission.
- Process transitions are checked and explained against an executable state machine.
- Process-control contracts bind launch, evidence, recovery and Kaizen policy.
- Instrumentation connects cockpit signals, feature traceability and multi-source feedback.
- Baseline comparison records synthetic measurement boundaries.

## Boundaries

- This is a public-safe synthetic demo.
- Generated context is not canonical state.
- Evidence and proposals do not authorize canonical updates.
- Synthetic evidence is not broad scientific proof.
