# Project Management Standard Harvest

Date: 2026-06-02
Status: public-safe transfer note

## Purpose

This note captures public-safe project-management patterns observed in a private
Mirai Graph pilot. It does not publish private project data, internal paths,
internal runtime traces, private handoffs or non-synthetic evidence.

The goal is to identify how the current public project-management profile can
evolve from a small task/decision graph into a stronger operating model for
managed projects, products and human-AI implementation workflows.

## Existing Public Baseline

Mirai Graph already includes an initial project-management profile:

- `profiles/project-management/profile.json`
- `profiles/project-management/README.md`

The current profile is intentionally small. It covers:

- goals;
- tasks;
- decisions;
- risks;
- milestones;
- stakeholders;
- evidence;
- governance gates.

This is enough for small Level 1 project packages, but larger managed projects
need stronger lifecycle, review, evidence and improvement structures.

## Reusable Management Loop

The private pilot exposed a reusable Mirai Graph project-control loop:

```text
canonical graph
-> generated human projection
-> semantic review
-> graph update proposal
-> approved canonical update
-> regenerated projection
-> validation
-> implementation evidence
-> continuous improvement
```

This loop keeps the canonical graph structured while still giving humans a
readable project view and review surface.

## Extension Candidates

### Object Kinds

Candidate object kinds for a richer profile:

- `initiative`
- `lifecycle_stage`
- `implementation_cluster`
- `workflow_batch`
- `review`
- `release_gate`
- `kaizen_item`
- `sync_proposal`
- `projection_view`
- `candidate`
- `closure_decision`

### Relation Types

Candidate relation types:

- `progresses_to`
- `implements`
- `produces_evidence`
- `requires_review`
- `requires_gate`
- `proposes_update_to`
- `accepted_into`
- `rejected_from`
- `supersedes`
- `closes_candidate`
- `improves_process`

### Governance Gates

Candidate gates:

- `semantic_review_before_canonical_update`
- `evidence_pack_before_implementation_status_change`
- `owner_approval_before_release_gate_pass`
- `public_safety_review_before_public_transfer`
- `coordinator_review_before_graph_sync`

## Standard Gaps

### Human Projection Feedback

The public standard already has projection views, but it should also define a
repeatable feedback loop where generated human-readable documents are reviewed
against the canonical graph and then converted into explicit update proposals.

Candidate public artifact:

- `standard/human-projection-feedback-loop.md`

### Graph Sync Evidence

Agentic or distributed implementation should not mutate canonical graph state
directly. Implementers should produce evidence packs and graph sync proposals
for coordinator review.

Candidate public artifacts:

- `standard/graph-sync-evidence-protocol.md`
- `schemas/graph-sync-evidence-pack.schema.json`
- `schemas/graph-sync-proposal.schema.json`

### Candidate Closure

Extraction and review workflows produce uncertain candidates. Mirai Graph needs a
standard way to close candidates as accepted, already covered, false positive,
boundary decision or future backlog.

Candidate public artifacts:

- `standard/proposal-candidate-closure.md`
- `schemas/proposal-candidate-closure.schema.json`

### Continuous Improvement

Meaningful workflows should leave lessons and process improvements in the graph
without automatically changing canonical project state.

Candidate public artifacts:

- `standard/kaizen-loop.md`
- `schemas/kaizen-item.schema.json`

## Public Safety Boundary

Safe to publish:

- generalized object kinds;
- generalized relation types;
- generalized gates;
- synthetic examples;
- schema shapes;
- validation rules;
- limited claims about conformance and reproducibility.

Do not publish:

- private project paths;
- internal company policies;
- private handoff text;
- private runtime traces;
- package-specific implementation decisions from private work;
- broad claims that a private pilot proves universal effectiveness.

## Recommended Next Public Batch

Create a synthetic project-management example that demonstrates:

```text
request
-> graph baseline
-> generated human projection
-> semantic review
-> graph sync proposal
-> evidence pack
-> coordinator approval
-> canonical update
```

This should be validated separately from the current minimal project-management
profile so the alpha.6 public surface remains stable while the richer extension
is tested.

## Batch Result

The first synthetic control-loop example now lives at:

```text
examples/managed-project-control-loop/
```

It intentionally uses the current `project_management` profile rather than
extending `profile.json`. Workflow batches, sync proposals and approval flow are
represented through existing `task`, `decision`, `evidence`, `milestone`,
`risk` and `governance_gate` objects. This keeps alpha.6 stable while making the
future extension gap concrete.

### Implementation Control Profile Result

The public repository now includes a separate implementation-control profile:

```text
profiles/implementation-control/
standard/implementation-control.md
schemas/implementation-control-loop.schema.json
examples/implementation-control-minimal/
```

This separates ordinary project management from governed implementation work.
The new profile models baselines, projection views, semantic reviews, workflow
batches, evidence packs, sync proposals, approval gates, controlled updates,
implementation state and improvement items.

Validation coverage:

```bash
npm run validate:profiles
npm run validate:implementation-control
npm run release:check
```

## Implementation Control Cycle Hardening

The next public-safe hardening step generalized the managed-project pattern into
reusable implementation-control cycles. This remains a synthetic public
transfer, not publication of private project evidence.

Added public concepts:

- human projection feedback cycle;
- implementation planning cycle;
- bounded work batch cycle;
- review and evidence cycle;
- release or publish cycle;
- runtime feedback cycle;
- explicit launch, drift, proposal, approval and controlled-update boundaries.

Public artifacts:

```text
standard/implementation-control-cycles.md
schemas/implementation-control-cycle.schema.json
examples/implementation-control-cycles/
```

Validation coverage:

```bash
npm run validate:implementation-control-cycles
npm run release:check
```

Boundary: public Mirai Graph receives the generalized model, schemas and
synthetic examples. Private project details, internal paths, runtime traces,
private transfer notes and organization-specific policies remain outside the
public repository.

### Cycle Transitions And Kaizen

A later public-safe hardening step generalized continuous-improvement process
control into:

```text
cycle completed
-> transition decision
-> kaizen review
-> classified improvement
-> blocking/non-blocking decision
-> next governed cycle
```

Added public concepts:

- cycle transition contract with required outputs, gates, handoff artifact,
  owner, failure behavior and recovery behavior;
- `kaizen_improvement` as a meta-cycle separate from runtime feedback;
- Kaizen finding taxonomy for artifact, graph/spec, process, validator,
  tooling, DNA alignment, quality, safety, drift and user-value findings;
- blocking rule for safety, quality, DNA alignment and critical drift findings;
- fail-closed validation for unknown cycle refs, duplicate transitions and
  missing transition fields.

Boundary: private pilot evidence remains private. Public Mirai Graph receives
only the generalized pattern, synthetic example and schema/validator behavior.

## Governance Standards Transfer

The next public-safe transfer generalized the remaining governance patterns
into universal Mirai Graph standards:

- graph DNA alignment;
- source boundary contracts;
- work state machines;
- recovery and resume records;
- risk control matrices;
- multi-agent coordination contracts.

Public artifacts:

```text
standard/graph-dna-alignment.md
standard/source-boundary-contract.md
standard/work-state-machine.md
standard/recovery-resume.md
standard/risk-control-matrix.md
standard/multi-agent-coordination.md
```

Validation coverage:

```bash
npm run validate:dna-alignment
npm run validate:work-state
npm run validate:risk-control
npm run validate:source-boundary
npm run release:check
```

Boundary: these standards describe reusable project-agnostic governance
patterns. They do not publish private pilot data, real repository paths,
organization-specific policies or private execution evidence.
