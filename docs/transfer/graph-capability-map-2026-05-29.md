# Mirai Graph Public Capability Map

Date: 2026-05-29

Status: public-safe transfer map

## Purpose

This map connects practical `$graph` capability areas to public Mirai Graph
standard sections, schemas, tooling, examples and evidence artifacts.

It is not a publication of internal skill implementation details. It records
which reusable ideas are already represented in the open repository and which
ideas still need public standardization.

## Public Transfer Boundary

Transfer only public-safe concepts:

- implementation-independent model elements;
- schemas and validators;
- synthetic examples and benchmarks;
- adoption guides;
- research protocols;
- limited claims backed by public artifacts.

Do not transfer:

- private project data;
- raw internal chats or handoffs;
- customer or employee material;
- secrets or private runtime paths;
- organization-specific procedures that have not been generalized.

## Capability Coverage

| Practical capability area | Public Mirai Graph coverage | Status | Next public step |
| --- | --- | --- | --- |
| Repository as graph source of truth | `docs/repository-purpose.md`, `README.md`, `ROADMAP.md` | covered | Keep purpose, roadmap and release notes aligned. |
| Core object model | `standard/object-model.md`, `schemas/object.schema.json`, package fixtures | covered with notes | Add richer object-family examples for more profiles. |
| Typed relation model | `standard/relation-model.md`, `schemas/relation.schema.json`, relation-id validation | covered with notes | Expand impact traversal and change-review semantics. |
| Evidence and provenance | `standard/evidence-provenance.md`, evidence fields, synthetic source corpus | covered with notes | Add evidence-level taxonomy and validation checks. |
| Lifecycle and readiness | `standard/lifecycle-readiness.md`, readiness validation, `packages/cli/readiness-score.js` | partial | Standardize readiness-score bands and caps as a first-class section. |
| Graph DNA | `standard/graph-dna.md` | partial | Add validation examples and DNA-to-seed traceability. |
| Graph Seed | `standard/graph-seed.md`, `schemas/graph-seed.schema.json`, seed examples, seed validation | covered with notes | Add more negative seed fixtures and adoption walkthroughs. |
| Graph Embryo | `standard/graph-embryo.md`, `schemas/graph-embryo.schema.json`, seed preview output | covered with notes | Add embryo review-result artifacts and promotion rules. |
| Canonical graph state | `standard/standard-v0.1.md`, package manifest schema, graph objects/relations | covered with notes | Define canonical write/update proposal format. |
| Generated context packs | `standard/context-pack-generation.md`, `schemas/context-pack.schema.json`, `packages/cli/context-pack.js`, context-pack validation | covered with notes | Add schema-level fixtures for selection explanation edge cases. |
| Selection explanations | context-pack `selection.object_explanations` and `selection.relation_explanations` | covered | Add reviewer guidance for interpreting scores. |
| Safety-sensitive context inclusion | context-pack generation policy and semantic review artifacts | partial | Turn safety inclusion into an explicit standard subsection. |
| Governance gates | `standard/governance.md`, gate result schema and examples | partial | Add proposal/approval flow with dry-run and apply boundaries. |
| Profiles | `standard/profiles.md`, `profiles/`, profile validation and profile conformance fixtures | covered with notes | Add organization-governance, research-program and human-AI profiles later. |
| AI employee graph-as-brain | `profiles/ai-employee/`, `standard/graph-as-ai-brain.md`, `examples/ai-employee-minimal/` | alpha | Validate through Larena/AI pilot before making stronger runtime claims. |
| Action/runtime boundary | `standard/action-runtime-boundary.md`, AI employee fixture approval gate | alpha | Add proposal/action/result schemas after runtime patterns stabilize. |
| Feedback learning gate | `standard/feedback-learning-gate.md`, AI employee fixture feedback and lesson proposal | alpha | Add replay/evaluation result artifact schema. |
| Profile conformance evidence | positive and negative fixtures, `validate-profile-results.js` | covered | Keep stored results regenerated before releases. |
| Test suite and conformance levels | `standard/test-suite.md`, `standard/conformance-levels.md`, `npm run release:check` | covered with notes | Split release checks into named conformance levels. |
| Context reduction benchmark | `benchmarks/synthetic-context-reduction-v0/` and result artifacts | covered with limits | Add more benchmark tasks and ablation protocols. |
| Semantic completeness review | `docs/research/semantic-completeness-review-protocol.md`, review JSON artifacts | partial | Add independent reviewer workflow and disagreement handling. |
| Measure-convert-optimize cycle | `benchmarks/protocols/measure-convert-optimize.md` | partial | Add a second public benchmark and repeatable result writer. |
| Adoption path | `docs/adoption/getting-started.md`, `docs/adoption/seed-to-validated-package.md` | covered with notes | Add one complete tutorial from seed to context-pack review. |
| Federation / cross-graph contracts | not yet public | planned | Draft `standard/federation.md` after core package contracts stabilize. |
| Runtime enablement policy | represented only indirectly through governance and readiness | planned | Draft public-safe runtime enablement policy without internal runtime details. |
| Migration/versioning | not yet public as a standard section | planned | Draft `standard/versioning-migrations.md` and migration dry-run artifacts. |

## Current Public Maturity

Current repository maturity:

`public_alpha_standard_with_executable_fixtures`

Reason:

The repository now contains a public standard foundation, schemas, validators,
context-pack generation, readiness scoring, profiles, synthetic benchmark,
semantic review artifacts, positive and negative conformance fixtures, and
release checks.

The repository is not yet:

- a complete standard;
- a full reference implementation;
- proof of real-world productivity improvement;
- a runtime action framework;
- a publication-ready empirical evidence package.

## Priority Standardization Backlog

### P0: Prepare `v0.1.0-alpha.4`

- summarize completed executable standard improvements;
- publish release notes;
- keep claims limited to public alpha tooling and synthetic evidence.

### P1: Human Control And Governance

- proposal/approval flow;
- dry-run/apply boundary;
- governance gate result lifecycle;
- safety and public-release gates.

### P2: Readiness And Review

- readiness score standard section;
- score bands and caps;
- semantic review workflow;
- reviewer disagreement and limitation records.

### P3: Versioning And Federation

- schema versioning;
- migration reports;
- cross-graph compatibility;
- public federation contract.

## Claim Rule

This capability map supports only this claim:

```text
Mirai Graph has a public alpha mapping from practical graph-method capabilities
to open standard sections, schemas, tooling and public-safe evidence artifacts.
```

It does not claim that the practical `$graph` skill is fully public, fully
standardized or externally validated.
