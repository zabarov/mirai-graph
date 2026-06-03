# Graph As AI Brain

Status: alpha standard draft

## Purpose

This section defines how Mirai Graph can model the stable brain of an AI
employee without turning the standard into one specific AI-agent runtime.

## Core Principle

```text
AI employee is not a prompt.
AI employee is a governed runtime over an evolutionary graph.
The graph is the canonical brain/state/control model.
The runtime executes through tools, policies, approvals and audit.
```

## Brain Model

In this model, the graph stores durable state:

- identity of the AI employee;
- department and role;
- skills and specializations;
- knowledge and memory references;
- tools and capabilities;
- policies and approval gates;
- workflows and automation rules;
- actions, results, feedback and lessons;
- federation endpoints.

The graph does not directly execute actions. It provides the structured state
used by an implementation to generate context, select policies, request
approval, call tools and record results.

## Runtime Model

An implementation may run an AI employee using:

- an LLM or another reasoning engine;
- a tool adapter layer;
- queue or event processing;
- policy evaluation;
- approval workflows;
- audit logging;
- feedback evaluation.

These runtime choices are outside the core standard. Mirai Graph standardizes
the graph shape and safety boundaries that make implementations inspectable.

## Required Distinctions

An AI-employee implementation should keep these states separate:

- canonical graph state;
- generated context;
- runtime decision;
- proposed action;
- approved action;
- executed action;
- audited result;
- feedback;
- accepted lesson or behavior update.

Merging these states makes it difficult to audit why the employee acted, which
policy applied, whether approval was required and what changed after feedback.

## Anti-Patterns

- Treating a prompt as the entire AI employee.
- Letting generated context mutate canonical graph state.
- Treating a runtime decision as permission to execute.
- Recording only the final result without proposed action, policy and approval
  trace.
- Learning from feedback without replay, evaluation and approval.

## Profile Link

The `ai_employee` profile provides the first public object and relation set for
this model.
