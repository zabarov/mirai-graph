# Mirai Graph

Mirai Graph is an evolutionary graph operating model for managing the growth of
complex systems.

It defines how projects, products, organizations and human-AI systems can use
canonical graph state, generated context packs, evidence, readiness and
governance gates to coordinate knowledge, decisions and action.

Mirai Graph is the graph foundation of the broader Mirai direction: governed AI
systems that can work with people, projects and organizations through explicit
state, evidence, approval gates, feedback loops and controlled evolution.

## Why Mirai Graph

Many teams use documents, chats, task trackers and isolated knowledge bases as
their main working substrate. This becomes fragile when the system grows:
requirements change, decisions depend on each other, evidence is scattered and
AI assistants receive incomplete context.

Mirai Graph treats the working system as an evolving graph:

- objects represent the system state;
- relations make dependencies explicit;
- evidence links claims to sources;
- readiness records maturity and uncertainty;
- generated context packs provide task-specific AI context;
- governance gates separate suggestions, decisions and actions;
- profiles adapt the model to domains without changing the core standard.

## Strategic Goal

The long-term goal is to make Mirai Graph an open, verifiable and practical
standard for governed AI work. A Mirai Graph system should make it possible to
move from idea to action without losing context, ownership, evidence, process
discipline or human control.

In this framing, an AI agent is not just a prompt or chat session. It is a
governed graph-backed operating process: context, tools, policies, actions,
results, feedback and learning are connected through explicit state and
approval boundaries.

## Current Status

Status: public alpha.

This repository is being prepared as the public source of truth for the
Mirai Graph model, standard, methods, examples and reproducibility materials.

The model is related to the `Evolutionary Object Graph (EOG)` research program.
The current public name is `Mirai Graph`; `EOG` remains the scientific continuity
term for earlier preprint materials.

Current release: [v0.1.0-alpha.9](releases/0.1.0-alpha.9.md). The next planned
release theme is [v0.1.0-alpha.10 Adopter Workflow](releases/0.1.0-alpha.10.md):
make it easier to choose a profile, start from a template, validate a package,
produce a readable report and run a governed launch/evidence/kaizen loop.

## Intended Audiences

- Researchers who need a clear model, reproducible experiments and citation
  trail.
- Developers who need schemas, validators, examples and integration methods.
- Product teams that need adoption guides, profiles and operating procedures.
- Organizations that need governance patterns for complex human-AI systems.

## Repository Map

```text
docs/          Concept, terminology, methodology, adoption and research guides.
standard/      Implementation-independent standard sections.
schemas/       Machine-readable schemas and validation rules.
benchmarks/    Synthetic benchmarks and reproducibility packages.
examples/      Public-safe examples and anti-examples.
packages/      Reference tooling, libraries and CLI packages.
playground/    Runnable demo index backed by examples and CLI commands.
profiles/      Domain profiles for project, software, AI and process use cases.
pilots/        Public-safe pilot packages and reports.
publications/  Publication links, citation notes and reproducibility records.
```

## Start Here

Start by role:

- Researchers: [Practice And Science Program](docs/research/practice-science-program.md),
  [Scientific Evidence Package](docs/research/scientific-evidence-package.md),
  [Evidence Package v0.2](docs/research/evidence-package-v0.2.md),
  [Evidence Package v0.1](docs/research/evidence-package-v0.1.md),
  [Publications](publications/README.md).
- Developers: [Getting Started](docs/adoption/getting-started.md),
  [Choose A Profile](docs/adoption/choose-profile.md),
  [End-To-End Tutorial](docs/adoption/end-to-end-control-loop.md),
  [Developer Integration Guide](docs/adoption/developer-integration-guide.md),
  [Mirai Graph CLI](docs/adoption/cli.md),
  [Test Suite](standard/test-suite.md).
- Product teams: [Managed Project Control Loop Example](examples/managed-project-control-loop/README.md),
  [Implementation Control](standard/implementation-control.md),
  [Implementation Control Cycles](standard/implementation-control-cycles.md).
- Organizations and AI systems: [Graph As AI Brain](standard/graph-as-ai-brain.md),
  [AI Employee Graph Adoption](docs/adoption/ai-employee-graph.md),
  [Organization Governance](standard/organization-governance.md),
  [Process Control Contract](standard/process-control-contract.md).

Core references:

- [Repository Purpose](docs/repository-purpose.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Release Process](releases/README.md)
- [Concept](docs/concept.md)
- [Terminology](docs/terminology.md)
- [Standard v0.1 Draft](standard/standard-v0.1.md)
- [Profiles](profiles/README.md)
- [Templates](templates/README.md)
- [Mirai Graph To Mirai Graph Transition](docs/adoption/mirai-graph-transition.md)
- [Planned Alpha.10 Adopter Workflow](releases/0.1.0-alpha.10.md)

Current alpha.9 standard areas:

- [Object Model](standard/object-model.md)
- [Relation Model](standard/relation-model.md)
- [Lifecycle Readiness](standard/lifecycle-readiness.md)
- [Evidence Provenance](standard/evidence-provenance.md)
- [Context Pack Generation](standard/context-pack-generation.md)
- [Governance](standard/governance.md)
- [Graph Seed](standard/graph-seed.md)
- [Graph Embryo](standard/graph-embryo.md)
- [Hybrid Source Of Truth](standard/hybrid-source-of-truth.md)
- [Graph DNA Alignment](standard/graph-dna-alignment.md)
- [Implementation Control](standard/implementation-control.md)
- [Launch Record](standard/launch-record.md)
- [Work State Machine](standard/work-state-machine.md)
- [Process Control Contract](standard/process-control-contract.md)
- [Technology Quality Feedback](standard/technology-quality-feedback.md)
- [Organization Governance](standard/organization-governance.md)
- [Recovery Resume](standard/recovery-resume.md)
- [Risk Control Matrix](standard/risk-control-matrix.md)
- [Multi-Agent Coordination](standard/multi-agent-coordination.md)
- [Source Boundary Contract](standard/source-boundary-contract.md)
- [Route Explanation](standard/route-explanation.md)
- [Routing Fixtures](standard/routing-fixtures.md)
- [Federation Health](standard/federation-health.md)
- [Route Regression](standard/route-regression.md)
- [Conformance Levels](standard/conformance-levels.md)

Runnable materials:

- [Playground](playground/README.md)
- [Minimal Graph Example](examples/minimal-graph/README.md)
- [Minimal Implementation Control Example](examples/implementation-control-minimal/README.md)
- [Implementation Control Cycles Example](examples/implementation-control-cycles/README.md)
- [Launch Record Example](examples/launch-record-minimal/README.md)
- [Process Transition Example](examples/process-transition-minimal/README.md)
- [Process Control Contract Example](examples/process-control-contract-minimal/README.md)
- [Technology Quality Feedback Example](examples/technology-quality-feedback-minimal/README.md)
- [Organization Governance Example](examples/organization-governance-minimal/README.md)
- [Federation Routing Smoke Example](examples/federation-routing-smoke/README.md)
- [Synthetic Context-Reduction Benchmark](benchmarks/synthetic-context-reduction-v0/README.md)
- [Independent Implementation Pilot 001](pilots/independent-implementation-001-conference-planning/reports/pilot-report.md)
- [Independent Implementation Pilot 002](pilots/independent-implementation-002-software-specification/reports/pilot-report.md)
- [Independent Implementation Pilot 003](pilots/independent-implementation-003-ai-employee-workflow/reports/pilot-report.md)
- [Independent Implementation Pilot 004](pilots/independent-implementation-004-research-program/reports/pilot-report.md)
- [Independent Implementation Pilot 005](pilots/independent-implementation-005-organization-governance/reports/pilot-report.md)

## Validate A Graph Package

Run the initial validator:

```bash
node packages/cli/validate-mirai-graph.js examples/minimal-graph
node packages/cli/validate-mirai-graph.js benchmarks/synthetic-context-reduction-v0
node packages/cli/validate-mirai-graph.js examples/ai-employee-minimal
node packages/cli/validate-mirai-graph.js examples/skill-runtime-minimal
node packages/cli/validate-mirai-graph.js seed examples/graph-seed-minimal/graph-seed.json
node packages/cli/validate-mirai-graph.js profile profiles/software-specification/profile.json
node packages/cli/validate-mirai-graph.js profile profiles/skill-runtime/profile.json
node packages/cli/validate-mirai-graph.js context-pack benchmarks/synthetic-context-reduction-v0 benchmarks/synthetic-context-reduction-v0/results/context-pack.json
node packages/cli/validate-mirai-graph.js launch-record examples/launch-record-minimal/results/launch-record.json
node packages/cli/validate-mirai-graph.js process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
node packages/cli/validate-mirai-graph.js process-control-contract examples/process-control-contract-minimal/results/process-control-contract.json
node packages/cli/validate-mirai-graph.js technology-quality-feedback examples/technology-quality-feedback-minimal/results/technology-quality-feedback.json
node packages/cli/validate-mirai-graph.js graph-dna-alignment examples/graph-dna-alignment-minimal/results/graph-dna-alignment.json
node packages/cli/validate-mirai-graph.js work-state-machine examples/work-recovery-minimal/results/work-state-machine.json
node packages/cli/validate-mirai-graph.js recovery-resume-record examples/work-recovery-minimal/results/recovery-resume-record.json
node packages/cli/validate-mirai-graph.js risk-control-matrix examples/risk-and-coordination-minimal/results/risk-control-matrix.json
node packages/cli/validate-mirai-graph.js source-boundary-contract examples/source-boundary-minimal/results/source-boundary-contract.json
node packages/cli/validate-mirai-graph.js examples/organization-governance-minimal
node packages/cli/seed-preview.js examples/graph-seed-minimal/graph-seed.json
node packages/cli/context-pack.js benchmarks/synthetic-context-reduction-v0 --task-id task.notify_after_approval
node packages/cli/readiness-score.js benchmarks/synthetic-context-reduction-v0 --target-mode pilot
node packages/cli/validate-process-transition-report.js
node packages/cli/validate-baseline-comparison.js benchmarks/synthetic-context-reduction-v0/results/baseline-comparison-result.json
node packages/cli/playground-demo.js
node packages/cli/mirai-graph.js validate examples/minimal-graph
node packages/cli/mirai-graph.js report validation examples/minimal-graph
node packages/cli/mirai-graph.js explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
node packages/cli/mirai-graph.js report technology-quality-feedback examples/technology-quality-feedback-minimal/results/technology-quality-feedback.json
node packages/cli/mirai-graph.js release state --markdown
```

The supported alpha.9 command surfaces are `mirai-graph`,
`packages/cli/mirai-graph.js`, `packages/cli/mirai_graph.js`,
`packages/cli/validate-mirai-graph.js` and `mirai-graph-package.json`.

Or run the current smoke checks:

```bash
npm test
npm run playground:report
npm run validate:playground-report
npm run validate:baseline-comparison
npm run validate:technology-quality-feedback
npm run validate:adopter-workflow
npm run validate:release-state
```

Adopter workflow commands:

```bash
node packages/cli/mirai-graph.js choose-profile
node packages/cli/mirai-graph.js adopter plan developer
node packages/cli/mirai-graph.js adopter report templates/software-project-starter
```

## What This Repository Is Not

This repository is not a dump of private research, company or client material.
Private project data, internal chats, internal skill sources, secrets and raw
customer or employee data do not belong here.

Synthetic examples and benchmarks are clearly marked as synthetic. They support
method inspection and reproducibility, not broad external validity claims.

## License

- Code is licensed under the MIT License. See [LICENSE](LICENSE).
- Documentation, standard text and research materials are licensed under
  Creative Commons Attribution 4.0 International. See
  [LICENSE-DOCS](LICENSE-DOCS).

## Citation

Use [CITATION.cff](CITATION.cff) for citation metadata. Publication links will
be maintained in `publications/`.
