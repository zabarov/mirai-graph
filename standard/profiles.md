# Mirai Graph Profiles

Status: 1.0 release-candidate standard section

## Purpose

Profiles adapt Mirai Graph to domains without changing the core standard.

A profile may define additional object kinds, relation types, readiness rules,
governance gates, examples and adoption guidance.

Before adding a profile, use [Profile Boundaries](profile-boundaries.md).
Mirai Graph prefers extension of existing profiles before introducing new
profile names.

## Profile

A profile is a named specialization of Mirai Graph.

Release-candidate profiles:

- `software_specification`;
- `project_management`;
- `implementation_control`;
- `ai_employee`;
- `character_layer`;
- `skill_runtime`;
- `organization_governance`.

Proposal/experimental profiles:

- `societal_governance`.

## Profile Rules

A profile may extend:

- object kinds;
- relation types;
- evidence levels;
- readiness policies;
- governance gates;
- examples;
- validation fixtures.

A profile should not:

- override core semantics silently;
- weaken public-safety rules;
- claim conformance without tests;
- mix private domain material into public examples.
- duplicate an existing profile with a more attractive name;
- store bulk source content that belongs in source systems;
- turn generated context, evidence, feedback or episode traces into
  authorization.

## Core Profile

The `core` profile contains model elements expected across implementations:

- stable objects;
- typed relations;
- evidence;
- readiness;
- generated context packs;
- governance gates;
- conformance levels.

## Software Specification Profile

Initial example profile used by the synthetic benchmark.

Possible object kinds:

- package;
- feature;
- requirement;
- constraint;
- risk;
- component;
- task;
- evidence.

Possible relation types:

- implements;
- depends_on;
- blocks;
- evidences;
- generates;
- related_to.

## AI Employee Profile

Initial alpha profile for modeling AI employees as governed runtimes over an
evolutionary graph.

Possible object kinds:

- ai_employee;
- ai_department;
- role;
- skill;
- knowledge;
- memory;
- tool;
- capability;
- policy;
- workflow;
- action;
- result;
- feedback;
- lesson;
- governance_gate;
- federation_endpoint.

Possible relation types:

- has_role;
- has_skill;
- uses_knowledge;
- requires_capability;
- can_execute;
- requires_approval;
- triggered_by;
- responds_to;
- learns_from;
- updates_behavior;
- belongs_to_department;
- federates_with.

## Skill Runtime Profile

Initial alpha profile for modeling a governed skill, capability module or
service as a Hybrid Source Of Truth runtime context.

Possible object kinds:

- skill;
- capability;
- activity;
- rule;
- owner_domain;
- source_boundary;
- raw_source;
- runtime_context;
- projection_view;
- quality_gate;
- adoption_report;
- effectiveness_report;
- semantic_review;
- runtime_policy;
- fallback;
- handoff;
- learning_proposal;
- federation_contract.

Possible relation types:

- owns_domain;
- has_capability;
- supports_activity;
- uses_rule;
- requires_gate;
- requires_fallback;
- reads_source;
- generates_context;
- projects_view;
- preserves_semantics;
- measures_effectiveness;
- routes_to;
- hands_off_to;
- exports_contract;
- proposes_learning.

## Implementation Control Profile

Initial public profile for governing movement from graph baselines, generated
human projections and implementation plans into bounded work, evidence, sync
proposals, approval gates, controlled updates and process learning.

Possible object kinds:

- implementation_baseline;
- projection_view;
- semantic_review;
- implementation_cycle;
- graph_dna;
- component_dna;
- dna_alignment;
- source_boundary_contract;
- work_state_machine;
- recovery_record;
- risk_control;
- coordination_contract;
- workflow_batch;
- launch_gate;
- evidence_pack;
- sync_proposal;
- approval_gate;
- controlled_update;
- implementation_state;
- drift_check;
- kaizen_item.

Possible relation types:

- derives_projection;
- reviews_projection;
- aligns_with;
- defines_boundary;
- transitions_to;
- resumes_from;
- controls_risk;
- reserves_scope;
- requires_gate;
- launches_batch;
- produces_evidence;
- proposes_update;
- approves_update;
- updates_baseline;
- checks_drift;
- progresses_to;
- improves_process.

## Profile Conformance

Profile conformance should be declared separately from core conformance.

## New Profile Decision

New profile ideas are `proposal_only` until they answer:

1. What new behavior does this add?
2. Which existing profiles were considered?
3. Why is an extension not enough?
4. How does it preserve Hybrid Source Of Truth?
5. What validator, fixture, report, pilot or experiment can check it?
6. Why is it needed now?

Example:

```text
Core conformance: Level 1
Profile conformance: software_specification Level 1
```

## Open Questions

- Should profiles have machine-readable manifests?
- Should profiles declare allowed object kinds and relation types?
- Should profile validation be strict by default or advisory?
- How should cross-profile conflicts be resolved?
