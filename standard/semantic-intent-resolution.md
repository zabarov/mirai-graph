# Semantic Intent Resolution

Status: 1.0 release-candidate extension contract

## Purpose

Semantic Intent Resolution is an input-control contract for turning a free-form
human request into a governed work decision before execution starts.

It answers:

- what the user likely wants;
- what scale the work has;
- which process and owner should handle it;
- what context is missing;
- whether execution can start;
- which gates and evidence are required.

This is not a standalone Mirai Graph profile. It is an extension contract that
composes existing project, implementation, AI employee, technology feedback and
dynamic episode layers.

## Control Pattern

```text
request
-> intent hypothesis
-> work scale
-> owner/process decision
-> context-slot check
-> clarification, brief, workflow restore or safe execution
-> process control
-> evidence, episode trace and technology quality feedback
```

## Boundary

Semantic Intent Resolution does not authorize action.

```text
semantic confidence != approval
generated brief != authorization
proposal != canonical update
episode trace != permission to execute
```

High confidence in a route or intent still cannot bypass policy, approval,
security, live-operation, data-mutation, Git-history or destructive-action
gates.

## Required Fields

- `user_request`
- `intent_hypothesis`
- `confidence`
- `work_scale`
- `selected_chain_id`
- `process_model_id`
- `owner_role`
- `required_context_slots`
- `missing_context_slots`
- `safe_default_action`
- `execution_allowed`
- `evidence_requirements`

## Decision Rules

- Low confidence blocks execution and requires review.
- Missing required context for significant work blocks execution or creates a
  clarification/brief path.
- Track-level work must not be collapsed into one batch.
- Goal-level work requires goal evidence such as Done When, stages, batches,
  gates or evidence plan.
- Risky work requires the relevant gates even when intent confidence is high.
- Generated outputs do not update canonical graph state.

## Integration Points

- `project_management`: classifies work scale and track/goal/batch boundary.
- `implementation_control`: decides readiness before execution.
- `ai_employee`: selects role, owner and action boundary.
- `technology_quality_feedback`: checks whether intake followed the approved
  work technology.
- `dynamic_episode_layer`: records why a path was selected, blocked or
  clarified.

## Public Safety

Public examples must be synthetic. Do not publish private requests, customer
messages, runtime traces, internal handoff payloads, access details, tokens,
private policies or raw logs.
