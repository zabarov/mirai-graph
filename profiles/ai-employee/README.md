# AI Employee Profile

Status: alpha profile

## Purpose

The `ai_employee` profile adapts Mirai Graph to AI employees, AI departments and
federated AI-service systems.

It treats an AI employee as a governed runtime over an evolutionary graph:

- the graph stores canonical state, roles, skills, knowledge, memory, tools,
  policies, workflows and lessons;
- generated context helps a task;
- runtime execution happens through tools, approvals and audit;
- feedback proposes learning but does not mutate the graph automatically.

## Object Kinds

Initial allowed object kinds:

- `ai_employee`;
- `ai_department`;
- `role`;
- `specialization`;
- `skill`;
- `knowledge`;
- `memory`;
- `event`;
- `signal`;
- `action`;
- `tool`;
- `capability`;
- `policy`;
- `workflow`;
- `automation_rule`;
- `result`;
- `feedback`;
- `lesson`;
- `delegation`;
- `federation_endpoint`;
- `governance_gate`.

## Relation Types

Initial allowed relation types:

- `has_role`;
- `has_specialization`;
- `has_skill`;
- `uses_knowledge`;
- `requires_capability`;
- `can_execute`;
- `requires_approval`;
- `triggered_by`;
- `responds_to`;
- `delegates_to`;
- `escalates_to`;
- `supervises`;
- `learns_from`;
- `updates_behavior`;
- `belongs_to_department`;
- `federates_with`;
- `produces`;
- `governs`;
- `related_to`.

## Governance Gates

Initial gates:

- `human_review_before_canonical_write`;
- `approval_before_external_action`;
- `feedback_learning_before_behavior_update`;
- `public_safety_before_release`.

## Runtime Boundary

The profile does not make the graph a runtime by itself.

Use this separation:

```text
canonical graph state
-> generated context
-> runtime decision
-> proposed action
-> approval gate
-> executed action
-> audited result
-> feedback
-> learning proposal
-> canonical graph update
```

## Minimal Useful Package

A Level 1 AI-employee package should include:

- one `ai_employee`;
- one `role`;
- one `skill`;
- one `tool`;
- one `capability`;
- one `policy`;
- one `workflow`;
- one `action`;
- one `result`;
- one `feedback`;
- one `lesson`;
- one `governance_gate`;
- evidence objects or source records where claims need support.

## Current Limitations

The profile does not yet standardize:

- provider-specific LLM capabilities;
- queue or worker implementation;
- authentication and authorization runtime;
- tool sandboxing;
- long-term memory storage engines;
- user interface requirements;
- federation trust protocols.

These belong to implementation profiles or future standard sections.

## Example

Minimal synthetic fixture:

`examples/ai-employee-minimal/`
