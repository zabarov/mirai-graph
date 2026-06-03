# GrowGraph Playground Demo Report

Status: deterministic alpha demo

## Control Loop

```text
seed -> graph -> context -> launch -> transition -> evidence -> kaizen
```

## Demo Inputs

- Synthetic package: `benchmarks/synthetic-context-reduction-v0`
- Objects: `12`
- Relations: `8`
- Context pack: `context_pack.task_notify_after_approval`
- Launch record: `launch_record.synthetic_batch`
- Transition request: `transition_request.release_ready_to_released`
- Process-control contract: `process_control_contract.synthetic_executable_process`

## Commands

```bash
npm run validate:minimal
npm run seed:preview
npm run context:generate
npm run validate:launch-record
npm run validate:process-transition
npm run validate:process-control
npm run validate:implementation-control-cycles
```

## What This Demonstrates

- GrowGraph can validate a graph package.
- GrowGraph can generate task-specific context from graph state.
- Launch records describe bounded work permission.
- Process transitions are checked against an executable state machine.
- Process-control contracts bind launch, evidence, recovery and Kaizen policy.

## Boundaries

- This is a public-safe synthetic demo.
- Generated context is not canonical state.
- Evidence and proposals do not authorize canonical updates.
- Synthetic evidence is not broad scientific proof.
