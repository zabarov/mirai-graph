# Mirai Graph Standard Gap Report

Date: 2026-05-28

Status: initial public-safe comparison

Historical note:

This report is retained as the initial transfer baseline. The current public
capability map is `docs/transfer/graph-capability-map-2026-05-29.md`.

## Purpose

This report compares the practical `$graph` skill methodology with the public
Mirai Graph repository.

The goal is not to copy private implementation details. The goal is to identify
which reusable concepts should become public standard sections, schemas,
profiles, tooling, experiments or publication artifacts.

## Sources Compared

Practical source:

`$graph` skill methodology and public-safe reference names.

Public target:

Mirai Graph public repository after `0.1.0-alpha.0` plus the practice/science bridge.

## Summary Verdict

Mirai Graph public repository status:

`foundation_ready_with_major_method_gaps`

Reason:

The public repository now has a coherent foundation: standard draft, schemas,
validator, examples, synthetic benchmark, adoption guide and research/practice
program framing. However, the practical `$graph` skill contains more mature
methodology for graph seed growth, human control surfaces, readiness scoring,
rollout, runtime gating, migration, federation and measured conversion.

The next phase should transfer the reusable parts into public-safe Mirai Graph
standard sections and tooling.

## Gap Classes

### Class A: Standard Gaps

These are reusable model concepts that should become public standard sections.

| Gap | Practical `$graph` capability | Current Mirai Graph status | Recommended public artifact |
| --- | --- | --- | --- |
| Graph DNA | Defines why the graph exists, its evolution vector and non-negotiable principles. | Mentioned indirectly only. | `standard/graph-dna.md` |
| Graph Seed | Controlled growth contract for starting complex graphs safely. | Mentioned in docs, not standardized. | `standard/graph-seed.md`, `schemas/graph-seed.schema.json` |
| Graph Embryo | Reviewable candidate graph before canonical write. | Not defined as standard artifact. | `standard/graph-embryo.md`, `schemas/graph-embryo.schema.json` |
| Projection Views | Human-facing slices such as readiness, risk, impact and approval queue. | Not present. | `standard/projection-views.md` |
| Proposal/Approval Flow | Generated analysis -> proposal -> review -> dry-run -> approved apply -> validate. | Governance is conceptual only. | `standard/proposal-approval.md` |
| Readiness Score | Target-mode readiness bands and caps. | Conformance exists, but no GRS. | `standard/readiness-score.md`, schema |
| Content Quality Score | Separate content fitness from graph structure. | Not present. | `standard/content-quality.md` or profile note |
| Impact Review | Relation impact traversal for changed objects. | Relation model is basic. | Expand `standard/relation-model.md` |
| Schema Migrations | Versioning, migration dry-run, reports and review gates. | Not present. | `standard/versioning-migrations.md` |
| Federation | Cross-graph export, handshake, query and compatibility. | Not present. | Later `standard/federation.md` |

### Class B: Tooling Gaps

These should become validators, generators, schemas or CLI commands.

| Gap | Current Public State | Recommended Tooling |
| --- | --- | --- |
| Context-pack generation | Documented, not generated. | `mirai-graph context generate` |
| Graph seed validation | Not present. | `mirai-graph seed validate` |
| Embryo preview | Not present. | `mirai-graph seed preview` |
| Readiness scoring | Not present. | `mirai-graph readiness --target-mode` |
| Proposal bundle | Not present. | `mirai-graph proposal bundle/review/apply` |
| Migration dry-run | Not present. | `mirai-graph migrate --dry-run` |
| Benchmark runner output | Only simple synthetic metric script. | Machine-readable benchmark result writer |
| Negative fixtures | Not present. | `examples/invalid-*` fixtures |
| Profile validation | Profiles are descriptive only. | `profile.schema.json` and strict profile fixtures |

### Class C: Research Gaps

These gaps need experiment design before strong scientific claims.

| Research Gap | Why It Matters | Recommended Artifact |
| --- | --- | --- |
| Current-mode vs graph-mode comparison | Need measured improvement, not assumption. | `benchmarks/protocols/measure-convert-optimize.md` |
| Semantic completeness | Context reduction may lose meaning. | semantic review rubric and EXP-002 |
| Ablation | Need know which layers matter. | EXP-003 protocol |
| Cross-domain replication | Need evidence beyond one internal domain. | EXP-004 protocol |
| Runtime safety | Action-capable graph use needs gates. | EXP-007 protocol |
| Human control surface quality | Dense graphs need usable projection views. | user-review protocol |

### Class D: Profile Gaps

These are domain adaptations that should not bloat the core standard.

| Profile | Current State | Recommended Next Step |
| --- | --- | --- |
| `software_specification` | Synthetic benchmark uses it informally. | Create profile manifest and allowed object/relation list. |
| `project_management` | Mentioned only. | Draft profile with goals, tasks, risks, milestones, decisions. |
| `organization_governance` | Mentioned only. | Draft governance-oriented object/relation families. |
| `research_program` | Implied by this work. | Draft profile for experiments, evidence, manuscripts and publications. |
| `human_ai_system` | Mentioned only. | Draft profile for agents, roles, tools, context packs and gates. |

### Class E: Private Or Implementation-Only Areas

These should not be copied directly into the public standard.

- private project materials;
- raw skill internals not approved for release;
- internal rollout records;
- customer or employee data;
- secret-handling implementation details;
- private runtime paths;
- organization-specific policies that are not generalized.

Public Mirai Graph can define the abstract standard and public-safe tooling
without publishing private operational material.

## Priority Transfer Plan

### P0: Make Public Mirai Graph A Better Standard

1. `standard/graph-dna.md`
2. `standard/graph-seed.md`
3. `standard/graph-embryo.md`
4. `standard/projection-views.md`
5. `standard/readiness-score.md`

Why first:

These explain how a graph grows and how humans control it. Without them,
Mirai Graph looks like a static knowledge-graph format rather than an operating
model for managed growth.

### P1: Make Public Mirai Graph More Usable

1. `schemas/graph-seed.schema.json`
2. `schemas/graph-embryo.schema.json`
3. `schemas/projection-view.schema.json`
4. CLI seed validation.
5. CLI readiness scoring.

Why second:

The repository should not only describe the method. Developers should be able
to test and use it.

### P2: Make Public Mirai Graph Research-Ready

1. Measure-convert-optimize public protocol.
2. Semantic completeness review rubric.
3. Benchmark result writer.
4. Negative fixtures.
5. Experiment backlog in public form.

Why third:

Scientific claims require measurement and repeatable evidence packages.

### P3: Prepare Profiles

1. `profiles/software-specification/`
2. `profiles/project-management/`
3. `profiles/research-program/`
4. `profiles/organization-governance/`

Why fourth:

Profiles make the standard adoptable without turning the core into a giant
domain-specific document.

## Immediate Next Batch

Recommended next implementation batch:

1. Add `standard/graph-dna.md`.
2. Add `standard/graph-seed.md`.
3. Add `standard/graph-embryo.md`.
4. Add `schemas/graph-seed.schema.json`.
5. Add `examples/graph-seed-minimal/`.
6. Extend CLI with seed validation.

Acceptance:

- `npm test` passes;
- minimal seed fixture validates;
- standard links updated;
- no private implementation material is copied.

## Publication Use

This report can support future scientific work by showing:

- the distinction between practical implementation and public standard;
- the gap between current tooling and publishable evidence;
- the plan for converting operational lessons into reproducible artifacts;
- the need for measured validation before stronger claims.

Potential manuscript use:

- methodology maturation section;
- limitations and future work;
- standardization roadmap;
- validation plan for v1.4 or a follow-up paper.
