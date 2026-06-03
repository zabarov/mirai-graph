# GrowGraph Repository Purpose

Status: draft alignment brief

## Mission

GrowGraph is an open research, standardization and developer-adoption
repository for an evolutionary graph operating model that helps manage the
growth of complex systems.

The repository should become the public source of truth for:

- the GrowGraph / EOG model;
- the implementation-independent standard;
- methodological materials;
- reusable developer methods and libraries;
- adoption profiles and step-by-step implementation guides;
- synthetic benchmarks and playground materials;
- publications, citations and research evidence.

For the current public alpha, "source of truth" means public standardization
and reproducible examples. It does not mean that private project graphs,
internal workflows or generated context packs are published here.

## Core Positioning

Working public name:

`GrowGraph`

Scientific continuity:

`Evolutionary Object Graph (EOG)`

Recommended description:

```text
GrowGraph is an evolutionary graph operating model for managing the growth of
complex systems, from projects and products to organizations and human-AI
systems.
```

The model is not just a knowledge graph. It combines:

- canonical graph state;
- generated context packs;
- typed objects and relations;
- evidence and provenance;
- readiness and lifecycle state;
- profiles;
- governance gates;
- feedback loops;
- implementation and adoption methods.

The current alpha also makes the operating model executable enough to test:

- launch records define bounded work permission;
- process transitions validate movement through a state machine;
- negative fixtures prove false transitions fail closed;
- recovery/resume records prevent chat-only continuation;
- risk, coordination and source-boundary contracts make governance explicit;
- Kaizen closure records reusable process learning without automatic canonical
  update.

## Primary Goals

### 1. Describe The Standard And Model

The repository must define the standard and all required model elements:

- terminology;
- object model;
- relation model;
- lifecycle and readiness model;
- evidence and provenance rules;
- generated context-pack rules;
- profiles and extension points;
- governance gates;
- executable process-control contracts;
- launch records and transition rules;
- source-boundary and recovery rules;
- conformance levels;
- examples and anti-examples.

### 2. Provide Methodological Materials

The repository must explain how to work with the model in practice:

- how to identify system objects;
- how to form a graph seed;
- how to grow a graph embryo;
- how to maintain canonical graph state;
- how to generate task-specific context packs;
- how to evaluate readiness;
- how to govern updates and actions;
- how to use the model in research, product and organizational settings.

### 3. Provide Reusable Methods And Libraries

The repository should eventually include code that makes the standard easy to
adopt:

- schemas;
- validators;
- CLI tools;
- context-pack generators;
- benchmark runners;
- import/export utilities;
- reference implementations;
- adapters for common project structures.

The first code should be small and testable. The standard must not depend on
one implementation.

Current alpha tooling is a reference implementation, not the standard itself.
It validates public-safe packages and examples so readers can inspect the model
through executable checks.

### 4. Provide Use Cases, Profiles And Adoption Guides

The repository should include practical profiles and step-by-step guides for:

- project management;
- product development;
- software specification;
- AI-agent knowledge management;
- organizational governance;
- research-program management;
- public-sector or country-scale governance as a future conceptual profile.

Profiles should define how the core model is specialized without changing the
standard itself.

### 5. Provide Playground And Synthetic Evidence

The repository should include public-safe materials that let users inspect and
test the model:

- synthetic datasets;
- benchmark tasks;
- expected context packs;
- reproducible metric scripts;
- playground examples;
- tutorials;
- limitations and threats to validity.

Synthetic evidence must be clearly separated from real-world validation.

In the current alpha, `playground/` is an index of runnable CLI examples. A
hosted or interactive playground is future work.

### 6. Link Publications And Research Evidence

The repository should maintain a research trail:

- links to SSRN, preprints and future journal publications;
- citation metadata;
- publication-ready abstracts where appropriate;
- reproducibility notes;
- research roadmap;
- validation results;
- response-to-review notes if public.

It may include publication texts only when licensing and venue policy allow it.

The current scientific layer should be read as a research evidence package and
program plan, not as peer-reviewed proof of broad effectiveness.

## Intended Audiences

### Researchers

Need:

- clear model definitions;
- relationship to prior work;
- reproducible experiments;
- limitations;
- citation and publication links.

### Developers

Need:

- schemas;
- examples;
- libraries;
- CLI commands;
- integration guides;
- tests and validation checks.

### Product Teams

Need:

- adoption guides;
- use-case profiles;
- maturity levels;
- operating procedures;
- governance patterns.

### Organizations

Need:

- governance model;
- roles and responsibilities;
- evidence and decision flows;
- lifecycle/readiness rules;
- implementation roadmap.

## What This Repository Is

- A public standardization workspace.
- A developer adoption kit.
- A research evidence and reproducibility hub.
- A source of public terminology and examples.
- A bridge between scientific publication and practical implementation.

## What This Repository Is Not

- A dump of the private `science` repository.
- A publication of raw SIMAI, Larena, customer, employee or internal skill data.
- A claim that the model is already universally validated.
- A peer-reviewed journal publication by itself.
- A single product implementation that defines the whole standard.
- A place for secrets, private chats, internal access details or raw client work.

## Public-Safe Source Policy

The private `science` repository remains the internal research workspace.

Materials may be copied into `growgraph` only when they are:

- public-safe;
- generalized or synthetic;
- free of private project names unless explicitly approved;
- free of secrets and access details;
- clear about evidence level;
- licensed or authored for public release.

Before copying from `science`, check:

- no raw SIMAI or Larena source material;
- no customer or employee data;
- no internal chat fragments;
- no private skill implementation details;
- no overclaiming of external validity;
- no SSRN preprint presented as peer-reviewed publication.

## Repository Shape

Recommended initial structure:

```text
README.md
LICENSE
LICENSE-DOCS
CITATION.cff
ROADMAP.md
docs/
  concept.md
  repository-purpose.md
  terminology.md
  standard-roadmap.md
  methodology/
  adoption/
  profiles/
standard/
  standard-v0.1.md
  object-model.md
  relation-model.md
  lifecycle-readiness.md
  evidence-provenance.md
  governance.md
  conformance-levels.md
schemas/
benchmarks/
  synthetic-context-reduction-v0/
examples/
  synthetic-publishing-platform/
packages/
  cli/
  js/
  python/
playground/
publications/
```

## Development Phases

### Phase 0: Public Foundation

Done when:

- README exists;
- purpose brief exists;
- license strategy exists;
- citation metadata exists;
- public-safe concept and standard roadmap exist.

### Phase 1: Standard Draft

Done when:

- terminology exists;
- object model exists;
- relation model exists;
- evidence/provenance rules exist;
- governance and conformance sections exist;
- examples and anti-examples exist.

### Phase 2: Method And Adoption Kit

Done when:

- step-by-step adoption guide exists;
- core profiles exist;
- implementation checklist exists;
- tutorial examples exist.

### Phase 3: Reusable Tooling

Done when:

- schemas exist;
- validator exists;
- CLI can check a GrowGraph package;
- context-pack generation example exists;
- tests are included.

### Phase 4: Evidence And Playground

Done when:

- synthetic benchmark is public;
- benchmark runner is reproducible;
- playground is available;
- limitations are documented;
- validation roadmap is public.

### Phase 5: Publication And Ecosystem

Done when:

- publications are linked;
- citation metadata is maintained;
- contributor guide exists;
- roadmap separates research, standard and implementation tracks.

## Open Decisions

- Final public name: `GrowGraph` is accepted as the working name, but a naming
  and trademark/domain screen is still needed before strong branding.
- License split: likely `MIT` for code and `CC BY 4.0` for documentation and
  standard text, but this needs final confirmation.
- First implementation language: JavaScript, Python or both.
- Initial package format and schema format.
- Whether to host a separate website later.
- Whether standard text lives under `docs/`, `standard/` or both.

## Immediate Next Artifacts

1. `README.md`
2. `ROADMAP.md`
3. `LICENSE`
4. `LICENSE-DOCS`
5. `CITATION.cff`
6. `docs/concept.md`
7. `docs/terminology.md`
8. `standard/object-model.md`
9. `benchmarks/synthetic-context-reduction-v0/`

## Success Criteria

The repository is successful when a new researcher or developer can:

1. Understand what GrowGraph is.
2. Understand how it differs from a normal knowledge graph.
3. Read the standard elements.
4. Follow an adoption guide.
5. Run a synthetic benchmark or playground.
6. Validate a simple GrowGraph package.
7. Cite the model and find related publications.
8. Integrate the model into a real project without access to private SIMAI
   materials.
