# Profile Boundaries

Status: 1.0 release-candidate standard section

## Purpose

Mirai Graph uses profiles and layers to keep graph-governed work understandable.
This document defines how those profiles fit together and how to decide whether
a new idea should become a new profile, an extension of an existing profile, a
validator rule, a proposal or no change.

The goal is to protect Mirai Graph from abstraction creep. A useful standard
does not add a new layer for every useful concept. It adds structure only when
the structure changes behavior in a way that can be validated.

## Layer Map

Mirai Graph layers should be read from source to action:

```text
source systems
-> core graph model
-> domain profiles
-> project and governance control
-> implementation/process control
-> technology quality feedback
-> dynamic episode evidence
-> Kaizen and proposal loops
-> AI employee / skill runtime use
```

Each layer answers a different question.

| Layer | Question it answers | What it should contain | What it should not contain |
| --- | --- | --- | --- |
| Source systems | Where does the full truth live? | Files, docs, code, CMS, DB, tickets, workflow, raw evidence | Duplicate bulk content in graph state |
| Core graph model | What exists and how is it connected? | Objects, relations, evidence refs, readiness, governance boundaries | Domain-specific workflow semantics |
| Domain profiles | What type of system is this? | Profile-specific object kinds, relation types, examples, conformance rules | Everything from every other profile |
| Project/governance control | What are we trying to move and who owns it? | Goals, decisions, risks, roles, policies, metrics, responsibilities | Runtime event traces |
| Implementation/process control | How is work allowed to move? | Launch records, states, transitions, gates, evidence requirements | Business meaning that belongs in a domain profile |
| Technology quality feedback | Did work follow the approved technology? | Classified findings, blocking/non-blocking verdicts, routes to fix or Kaizen | General testing claims without process conformance |
| Dynamic episode evidence | What happened in this specific event and why? | Trigger, activated objects, selected path, blocked alternatives, evidence, feedback route | Authorization or canonical graph mutation |
| Kaizen/proposal loops | What should improve? | Lessons, process improvements, graph proposals, follow-up routes | Automatic canonical updates |
| AI employee / skill runtime | Who or what uses the graph at runtime? | Roles, skills, tools, policies, context, fallback, runtime contracts | Source-of-truth replacement for owner methods |

## Current Status Classes

Mirai Graph documents and profiles should make their status visible:

- `core`: part of the release-candidate standard and expected to remain stable.
- `release-candidate profile`: validated public profile for adopter use.
- `proposal`: public-safe design direction that is not yet core.
- `experimental`: validated or documented exploration that still requires
  stronger evidence, replay/regression or adopter feedback.
- `private pilot evidence`: internal or private evidence that must not be
  copied into public examples without approval and sanitization.

## Current Profile Boundaries

| Profile or layer | Owns | Does not own |
| --- | --- | --- |
| `software_specification` | Requirements, features, components, dependencies, implementation traceability | Project governance, AI worker behavior, process authorization |
| `project_management` | Goals, stages, tasks, decisions, risks, metrics, evidence and delivery movement | Detailed software object semantics or runtime event traces |
| `implementation_control` | Launch records, work states, transitions, evidence, approval, drift, recovery and controlled update | Domain facts that belong to software, AI employee or organization profiles |
| `technology_quality_feedback` | Whether the declared work technology was followed and how findings are routed | Unit-test success by itself, general acceptance, or release authorization |
| `dynamic_episode_layer` | What happened in a concrete event, why a path was selected and which alternatives were blocked | Canonical updates, permissions or durable source-of-truth content |
| `ai_employee` | AI worker model: role, skill, tools, policy, actions, results, feedback and lessons | Model-independent character principles or organization-wide governance |
| `character_layer` | Stable behavior governance independent of model backend | Tool permissions, runtime authorization or employee memory store |
| `skill_runtime` | Hybrid SOT runtime context for skills, fallback and federation contracts | Rewriting owner skill methodology as graph-only runtime |
| `organization_governance` | Departments, responsibility, policies, controls, strategy, programs, metrics and organization-scale feedback | Country-scale civic governance as a core 1.0 claim |
| `societal_governance` | Proposal/experimental public governance modeling | Core 1.0 release-candidate conformance |

## Extension Before Profile

Use this sequence before creating a new profile:

```text
existing field
-> existing object or relation
-> validator or gate rule
-> synthetic example
-> proposal document
-> new profile only if existing profiles cannot express the behavior
```

A new profile is justified only when all are true:

- it adds new verifiable behavior, not just a new name;
- it does not duplicate an existing profile;
- it strengthens Hybrid SOT;
- it helps make a decision, gate, transition, feedback route, audit,
  replay/regression result or Kaizen improvement;
- it can be checked by a validator, fixture, report, pilot or experiment;
- it is needed now, not merely interesting.

If those conditions are not met, keep the idea as `proposal`, `experimental`,
`extension_only` or `reject`.

## Anti-RAG And Anti-Bulk-Content Boundary

Mirai Graph is not a RAG index, CMS, search engine or bulk document store.

Source systems keep full content:

- files and documentation;
- source code;
- CMS records;
- database records;
- tickets, issues and workflow files;
- search and vector indexes when a product needs them.

Canonical graph state should keep only governable meaning:

- stable object ids;
- typed relations;
- short summaries;
- source and evidence references;
- readiness and lifecycle state;
- owner and responsibility links;
- rules, constraints and gates;
- transition, feedback, episode, replay and Kaizen metadata.

This keeps graph packages small, reviewable and source-owned. If an application
needs full-text search or semantic retrieval, use a search/index layer and let
Mirai Graph enrich it with status, evidence, validity, ownership, gates and
relations.

## Practical Scenarios

### Projects

Use:

```text
project_management
+ implementation_control
+ technology_quality_feedback
+ dynamic_episode_layer when action traceability matters
```

The graph should show where goals, decisions, risks, evidence and process
states live. It should not store every project document body.

### AI Employees

Use:

```text
ai_employee
+ character_layer
+ implementation_control
+ technology_quality_feedback
+ dynamic_episode_layer
```

The graph should govern role, tools, policies, behavior, actions and feedback.
It should not make generated context or character profiles into authorization.

### Skills

Use:

```text
skill_runtime
+ source-boundary contract
+ process-control gates
+ federation evidence/proposals
```

The graph should route skills, expose runtime context and preserve Hybrid SOT.
Raw skill sources remain authoritative for methodology and judgment.

### Organizations

Use:

```text
organization_governance
+ project_management
+ implementation_control
+ technology_quality_feedback
+ dynamic_episode_layer for important events
```

The graph should model responsibility, policy, controls, metrics, decisions and
feedback. It should not jump directly to state/country-scale claims without
organization-level evidence.

## Refactoring Policy

When profiles overlap, prefer boundary clarification over schema churn.

Safe refactoring:

- improve profile documentation;
- add examples and anti-examples;
- add validator warnings;
- add adoption guidance;
- mark proposal/experimental status explicitly.

Risky refactoring:

- rename object kinds without migration;
- merge profiles with different owners;
- move source content into graph state;
- treat episode/evidence/proposals as authorization;
- claim scientific or production proof from synthetic fixtures.

## Minimum Review For New Ideas

Every new profile/layer proposal should include:

- problem statement;
- existing profiles considered;
- new behavior that existing profiles cannot express;
- Hybrid SOT impact;
- validation or pilot plan;
- public/private boundary;
- decision: `accept`, `revise`, `extension_only`, `proposal_only` or `reject`.
