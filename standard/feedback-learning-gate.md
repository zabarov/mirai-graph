# Feedback Learning Gate

Status: alpha standard draft

## Purpose

This section defines how feedback can improve a GrowGraph-modeled AI employee
without allowing uncontrolled self-modification.

## Core Flow

```text
feedback -> proposal -> replay/evaluation -> approval -> canonical graph update
```

## Feedback

Feedback is an observation, review, correction, rating, error report or outcome
signal.

Feedback may come from:

- a human reviewer;
- an audited result;
- a failed action;
- a successful action;
- a monitoring signal;
- a peer AI employee;
- an external evaluation.

Feedback is evidence. It is not automatically a behavior change.

## Learning Proposal

A learning proposal describes what should change in the graph.

It may propose:

- updating a policy;
- adding or changing a lesson;
- changing a workflow;
- changing a skill description;
- adding a risk;
- changing a delegation rule;
- adding a new approval requirement.

## Replay Or Evaluation

Before acceptance, the proposal should be evaluated.

Evaluation may include:

- replaying the failed scenario;
- comparing expected and actual result;
- checking policy impact;
- checking safety or public-release risk;
- checking whether the lesson is too broad;
- checking whether the change conflicts with existing graph state.

## Approval

Learning changes that affect future behavior should pass a governance gate.

Examples:

- `feedback_learning_before_behavior_update`;
- `human_review_before_canonical_write`;
- `public_safety_before_release`;
- `approval_before_external_action`.

## Canonical Update

After approval, a canonical graph update may add, deprecate or change objects
and relations.

The update should preserve:

- feedback evidence;
- proposal id or source;
- approval record;
- affected object and relation ids;
- limitation or rollback note when relevant.

## Anti-Patterns

- Treating every feedback item as a permanent lesson.
- Letting a failed action automatically rewrite policy.
- Updating behavior without preserving evidence.
- Merging runtime logs directly into canonical memory.
- Accepting broad lessons from one narrow example.

## Claim Rule

Passing through a feedback learning gate supports this limited claim:

```text
The behavior update was proposed, evaluated and accepted through a recorded
governance process.
```

It does not prove the updated behavior is universally correct.
