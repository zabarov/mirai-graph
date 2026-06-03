# GrowGraph Playground Demo Report

Status: deterministic alpha.8 demo

## Control Loop

```text
seed -> graph -> context -> launch -> transition explanation -> evidence -> kaizen -> baseline comparison
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
npm run validate:implementation-control-cycles
npm run validate:baseline-comparison
```

## Transition Explanation

- Requested transition: `release_ready -> released`
- Matched transition: `true`
- Required evidence: `release_evidence`
- Missing evidence: `0`
- Kaizen decision: `satisfied`

## Baseline Comparison

- Baseline context units: `620`
- GrowGraph context units: `270`
- Context reduction: `56.4516%`
- Baseline missed dependencies: `2`
- GrowGraph missed dependencies: `0`
- Verdict: `synthetic_growgraph_result_stronger_with_limits`

## What This Demonstrates

- GrowGraph can validate a graph package.
- GrowGraph can generate task-specific context from graph state.
- Launch records describe bounded work permission.
- Process transitions are checked and explained against an executable state machine.
- Process-control contracts bind launch, evidence, recovery and Kaizen policy.
- Baseline comparison records synthetic measurement boundaries.

## Boundaries

- This is a public-safe synthetic demo.
- Generated context is not canonical state.
- Evidence and proposals do not authorize canonical updates.
- Synthetic evidence is not broad scientific proof.
