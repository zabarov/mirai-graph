# Mirai 2 Controlled Beta Pilot Protocol

Status: `2.0.0-beta.1` candidate protocol

## Purpose

This protocol tests whether Mirai 2 can execute a bounded technology as an
inspectable program without silently changing graph authority or invoking live
effects. It covers three domains: Federation, Larena code generation and an AI
employee workflow.

The beta pilot is engineering evidence. It is not, by itself, evidence that
Mirai 2 outperforms prompts or Mirai Graph 1.4.

## Common Conditions

Every pilot result reserves the same three conditions:

1. `plain_instructions` - the task executed from ordinary instructions;
2. `mirai_graph_1_4` - the task supported by the declarative graph/process
   layer;
3. `mirai_2_0` - the task executed through compiled Mirai Program IR.

A condition may cite historical evidence, but missing evidence must remain
`not_available` or `planned`. A pilot cannot convert an absent comparison into
a measured improvement.

## Required Evidence

- immutable task identifier and source revision alias;
- authoring program and compiled digest-bound JSON IR;
- pure or governed episode;
- an independent checker result bound to that episode or sanitized evidence;
- replay result proving that replay did not repeat real effects;
- sanitized evidence package for governed effects;
- safety boundary with zero production, network, customer-facing, canonical
  graph and automatic-learning effects;
- metric values or explicit `null` where the current evidence cannot measure a
  metric;
- human-review status and limitations.

## Domain Boundaries

### Federation

Use a public-safe technology-shaped fixture that preserves route, packet,
verification, reverse audit and Kaizen decisions. Do not edit the installed
federation runtime during the pilot.

### Larena

Use one frozen task in an isolated worktree. Writes are limited to the task's
declared files and require a host-issued approval receipt. Only allowlisted
syntax, visible and hidden acceptance commands may run. No provider, network,
production or package release effect is allowed.

### AI Employee

Use dry-run/replay/no-send semantics. The program may model intent, context,
character boundary, decision, draft, approval decision, simulated action,
feedback and lesson. It cannot send a message, call a provider, mutate Bitrix
or promote a lesson into canonical state.

## Acceptance

Engineering evidence is complete when the Mirai 2 condition has a valid IR,
episode, replay result and safety record, with zero unauthorized effects and no
false completion claim. This does not complete scientific comparison when a
baseline, blinded human review or sufficient repetitions are missing.

## Claim Boundary

Passing this protocol demonstrates bounded executable conformance and audit
evidence for the recorded tasks. It does not demonstrate general model-quality
improvement, production safety or scientific superiority.
