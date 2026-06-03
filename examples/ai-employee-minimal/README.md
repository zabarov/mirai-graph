# Minimal AI Employee Example

Status: synthetic alpha fixture

## Purpose

This example shows how the `ai_employee` profile can model a governed AI
employee without treating the graph as an uncontrolled runtime.

The fixture includes:

- one AI employee;
- one department and role;
- one skill;
- knowledge and memory references;
- a tool and required capability;
- an external-action policy and approval gate;
- a workflow and proposed action;
- an audited result;
- feedback and a proposed lesson;
- a federation endpoint placeholder.

## Safety Boundary

The fixture preserves this distinction:

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

It does not include real users, customer tickets, credentials, private runtime
paths or provider-specific implementation details.

## Validate

```bash
node packages/cli/validate-mirai-graph.js examples/ai-employee-minimal
```

Or run the full suite:

```bash
npm run release:check
```
