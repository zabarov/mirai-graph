# Dynamic Episode Layer

Status: proposal/experimental standard section

## Purpose

The Dynamic Episode Layer records how a concrete event moves through a Mirai
Graph system and why the system reacted the way it did.

Existing technology chains define how work should be performed. Dynamic
episodes record what actually happened for one event:

```text
event
-> activated graph objects and relations
-> selected workflow and technology chain
-> selected path
-> blocked alternatives
-> gates
-> result
-> findings
-> feedback route
-> Kaizen or graph proposal
```

This layer is designed for AI employees, AI-assisted code generation,
governance simulations, project control and other systems where a result is not
enough. A reviewer must be able to inspect why a path was selected, why other
paths were blocked and which evidence supports the decision.

## Core Rule

```text
canonical graph state != runtime trace != generated explanation != approval
```

A dynamic episode may create evidence, explanations, audit records, feedback
and proposals. It must not mutate canonical graph state or authorize execution
by itself.

## Required Boundaries

- An episode trace is evidence, not authorization.
- Generated context is not canonical state.
- Feedback is not an automatic graph update.
- Passing tests do not mean acceptance.
- Blocked paths must remain blocked until an owner-approved process changes the
  gate, policy or graph relation.
- Private event contents must not be copied into public examples or research
  packages.

## Record Levels

The layer distinguishes four record levels:

- `debug_log`: temporary implementation troubleshooting, short retention.
- `episode_trace`: structured record explaining one event reaction.
- `audit_record`: compact accountability record for later review.
- `research_dataset`: sanitized, public-safe evidence derived from traces.

## Dynamic Episode Lifecycle

```text
event_received
-> source_refs_loaded
-> graph_activation_recorded
-> workflow_selected
-> selected_path_recorded
-> blocked_paths_recorded
-> gates_evaluated
-> result_recorded
-> findings_classified
-> feedback_routed
-> kaizen_or_replay_candidate_recorded
```

## Required Fields

A valid dynamic episode trace must identify:

- event;
- source references;
- activated objects, relations, policies, gates and technology steps;
- selected path;
- blocked paths;
- findings and classifications;
- result;
- evidence references;
- limitations;
- explicit `canonical_write_allowed=false`.

## Relationship To Other Standard Sections

- `implementation-control` defines process state and false-transition guards.
- `technology-quality-feedback` checks whether the approved work technology was
  followed.
- `context-pack-generation` turns traces into bounded explanations.
- `feedback-learning-gate` governs proposal and learning updates.
- `action-runtime-boundary` prevents traces, evidence and proposals from
  becoming unauthorized actions.

## Conformance

This proposal starts at synthetic conformance:

- `D0_concept`: standard text only.
- `D1_synthetic_episode`: synthetic example and validator.
- `D2_internal_pilot`: internal project episode traces.
- `D3_replay_regression`: replay and regression evidence.
- `D4_audited_runtime`: operational audit records and retention policy.

The current public layer should claim no more than `D1_synthetic_episode` until
real pilots are validated.
