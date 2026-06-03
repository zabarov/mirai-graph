# AI Employee Profile Proposal

Status: alpha proposal

## Purpose

This proposal defines the public Mirai Graph direction for modeling an
AI employee as a governed runtime over an evolutionary graph.

The goal is to support systems such as Larena/AI without turning Mirai Graph
into a single AI-agent framework or publishing private implementation details.

## Core Thesis

```text
AI employee is not a prompt.
AI employee is a governed runtime over an evolutionary graph.
The graph is the canonical brain/state/control model.
The runtime executes through tools, policies, approvals and audit.
```

## Why A Separate Profile

The existing profiles model projects and software specifications. An
AI-employee system needs additional first-class concepts:

- roles and departments;
- skills and specializations;
- knowledge and memory;
- tools and capabilities;
- workflows and automation rules;
- policies and approval gates;
- actions, results, feedback and lessons;
- federation endpoints for multi-employee or multi-service systems.

These concepts should not bloat the core standard. They belong in a profile
that specializes Mirai Graph for agentic work while preserving the core
governance model.

## Public Scope

The public standard may define:

- graph object kinds for AI-employee modeling;
- relation types for skill, tool, policy and delegation structure;
- canonical state versus runtime/event boundaries;
- feedback learning gates;
- synthetic fixtures;
- validation rules;
- adoption guidance.

The public standard must not define:

- private Larena package internals;
- SIMAI customer or employee data;
- secret handling details beyond public-safe policy boundaries;
- one mandatory LLM provider;
- one mandatory runtime or queue implementation;
- uncontrolled self-modifying behavior.

## Larena/AI Boundary

Mirai Graph should define the portable model. Larena/AI may implement runtime
execution, UI, storage, queues, tools, permissions, audit logs and package
integration.

Portable Mirai Graph layer:

- AI employee graph model;
- object and relation semantics;
- policy gates;
- feedback learning lifecycle;
- profile conformance fixtures.

Larena/AI runtime layer:

- authentication and authorization;
- tool adapters;
- execution queues;
- event logs;
- UI screens;
- deployment topology;
- provider-specific integration.

## Minimal Alpha Scope

The first public alpha should include:

- `profiles/ai-employee/profile.json`;
- `profiles/ai-employee/README.md`;
- `standard/graph-as-ai-brain.md`;
- `standard/action-runtime-boundary.md`;
- `standard/feedback-learning-gate.md`;
- `docs/adoption/ai-employee-graph.md`;
- `examples/ai-employee-minimal/`;
- validation through `npm run release:check`.

## Safety Principles

1. Feedback does not mutate canonical graph state directly.
2. Generated context does not become authorization.
3. Runtime decisions do not equal executed actions.
4. Executed actions need audited results.
5. High-risk actions require explicit policy and approval gates.
6. Learning requires proposal, replay or evaluation, approval and canonical
   update.
7. Federation endpoints need compatibility and trust boundaries.

## Claim Rule

This proposal supports only this claim:

```text
Mirai Graph can model the public structure of an AI employee as a governed graph
profile with explicit runtime, action and learning boundaries.
```

It does not prove that any runtime implementation is safe, autonomous or
effective.
