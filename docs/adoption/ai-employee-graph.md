# AI Employee Graph Adoption

Status: alpha adoption guide

## Purpose

This guide explains how to start modeling an AI employee with Mirai Graph.

It is intended for teams that want an AI employee to have explicit roles,
skills, knowledge, tools, policies, workflows, feedback and learning gates.

## Step 1: Define The Employee Boundary

Start with one AI employee.

Define:

- employee id;
- department;
- role;
- allowed task area;
- forbidden task area;
- owner or reviewer;
- public/private data boundary.

Do not start with a broad autonomous agent. Start with a bounded employee.

## Step 2: Model Roles And Skills

Add:

- `role` objects for responsibilities;
- `skill` objects for capabilities that require knowledge or tools;
- `specialization` objects only when a role needs a narrower durable area.

Useful relations:

```text
ai_employee -> has_role -> role
role -> has_skill -> skill
role -> has_specialization -> specialization
```

## Step 3: Add Knowledge And Memory

Use:

- `knowledge` for reviewed reference material;
- `memory` for durable but reviewable learned context;
- `evidence` for source support.

Memory should not be an uncontrolled transcript dump. It should preserve source
and readiness.

Useful relations:

```text
skill -> uses_knowledge -> knowledge
skill -> uses_knowledge -> memory
```

## Step 4: Add Tools And Capabilities

Use:

- `tool` for the runtime adapter;
- `capability` for what the tool can safely do;
- `policy` for the rule that constrains use.

Useful relations:

```text
action -> requires_capability -> capability
tool -> can_execute -> action
policy -> governs -> governance_gate
```

## Step 5: Add Policy And Approval Gates

Every external, user-visible, irreversible, permission-changing or sensitive
action should have a governance gate.

Useful relation:

```text
action -> requires_approval -> governance_gate
```

Approval can be automatic only when a policy explicitly allows it.

## Step 6: Model Runtime Boundary

Keep runtime states separate:

```text
canonical graph state
-> generated context
-> runtime decision
-> proposed action
-> approval gate
-> executed action
-> audited result
```

The graph can describe the states. The runtime implementation executes and
audits them.

## Step 7: Add Feedback And Lessons

Feedback should produce a proposed lesson, not an automatic behavior change.

Useful relations:

```text
feedback -> responds_to -> result
lesson -> learns_from -> feedback
lesson -> updates_behavior -> workflow
```

Then apply the feedback learning gate:

```text
feedback -> proposal -> replay/evaluation -> approval -> canonical graph update
```

## Step 8: Validate

Use the minimal example:

```bash
node packages/cli/validate-mirai-graph.js examples/ai-employee-minimal
```

Use the full release gate:

```bash
npm run release:check
```

## What This Does Not Prove

A valid AI employee graph does not prove:

- the runtime is safe;
- the AI employee is effective;
- the tool adapter is secure;
- the policy is sufficient;
- the employee can act without oversight.

It proves only that the package follows the declared profile shape checked by
the current validator.
