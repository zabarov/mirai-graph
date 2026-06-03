# Mirai Graph Conformance Levels

Status: initial public draft

## Purpose

Conformance levels describe how completely an implementation follows the
Mirai Graph standard.

Conformance must be testable. A project should not claim a level without
evidence, fixtures or validation output.

## Level 0: Terminology Alignment

The implementation uses Mirai Graph terminology consistently but does not yet
provide a complete canonical graph package.

Expected evidence:

- terminology map;
- declared deviations;
- no claim of full implementation.

Useful for:

- early documentation;
- research discussion;
- internal planning.

## Level 1: Canonical Graph State

The implementation maintains objects and relations in a structured graph
package.

Minimum requirements:

- object ids are stable;
- relation ids are stable;
- relation source and target resolve to existing objects;
- readiness values are present;
- evidence boundaries are explicit;
- package passes the validator.

Current validator:

```bash
node packages/cli/validate-mirai-graph.js <package-dir>
```

Useful for:

- structured specification work;
- simple examples;
- early integration pilots.

## Level 2: Context-Pack Generation

The implementation can generate task-specific context packs from canonical
graph state.

Minimum requirements:

- context pack declares task boundary;
- included objects and relations are traceable;
- evidence references are preserved;
- omitted context is explainable;
- generated context is not treated as canonical state.

Useful for:

- AI-assisted work;
- context engineering;
- task-specific review and implementation.

## Level 3: Governance-Gated Operation

The implementation uses governance gates for accepted graph updates, public
claims or action-capable workflows.

Minimum requirements:

- governance gates are defined;
- gate results are recorded;
- blocked items remain traceable;
- action-capable workflows separate proposed, authorized and executed action;
- public claims are evidence-gated.

Useful for:

- organizational workflows;
- public documentation;
- safety-sensitive AI-assisted work;
- product or project governance.

## Level 4: Profiled Multi-Domain Operation

The implementation supports profiles and profile boundaries.

Minimum requirements:

- at least two profiles exist;
- profile-specific object kinds or relation types are documented;
- cross-profile conflicts are handled;
- conformance evidence is recorded per profile;
- core standard remains stable across profiles.

Useful for:

- multi-project systems;
- organizational adoption;
- cross-domain research;
- public-sector or country-scale conceptual modeling.

## Current Repository Conformance

Current status:

`Level 1 partial`

Evidence:

- minimal graph package validates;
- synthetic benchmark package validates;
- schemas and validator exist;
- standard sections are still incomplete.

Not yet present:

- full context-pack generation standard;
- governance gate result schema;
- profile conformance tests;
- package manifest schema;
- independent implementation pilot.
