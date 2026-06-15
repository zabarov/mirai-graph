# Mirai Graph

Mirai Graph is an evolutionary graph operating model for managing the growth of
complex systems: projects, products, organizations, research programs and
human-AI systems.

It connects canonical graph state, generated context, evidence, readiness,
process control, feedback and governance gates so people and AI systems can
work from explicit state instead of scattered chats, documents and task memory.

Status: public `1.0.0-rc.1` release candidate.

## Quick Start

Connect an existing project:

```bash
npm install -D mirai-graph
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
```

`detect` is read-only. `bootstrap --mode suggest` creates proposal/evidence
only. `init` creates starter graph files after you choose a profile.

For the guided path, use
[Connect A Project In 15 Minutes](docs/adoption/connect-project-15-minutes.md).

## What Should I Read First?

| If you are... | Start here | Then read |
| --- | --- | --- |
| Trying Mirai Graph in a project | [Connect A Project In 15 Minutes](docs/adoption/connect-project-15-minutes.md) | [Getting Started](docs/adoption/getting-started.md), [CLI](docs/adoption/cli.md) |
| A developer integrating validation | [Developer Integration Guide](docs/adoption/developer-integration-guide.md) | [Test Suite](standard/test-suite.md), [Templates](templates/README.md) |
| A researcher evaluating the model | [Scientific Evidence Package](docs/research/scientific-evidence-package.md) | [Practice And Science Program](docs/research/practice-science-program.md), [Publications](publications/README.md) |
| Building an AI employee | [AI Employee Graph Adoption](docs/adoption/ai-employee-graph.md) | [Character Layer Adoption](docs/adoption/character-layer.md), [Graph As AI Brain](standard/graph-as-ai-brain.md) |
| Managing an organization or program | [Organization Governance](standard/organization-governance.md) | [Project Management Profile](profiles/project-management/README.md), [Process Control Contract](standard/process-control-contract.md) |
| Looking for the full map | [Documentation Map](docs/README.md) | [Roadmap](ROADMAP.md), [Release Process](releases/README.md) |

## Why Mirai Graph

Complex work breaks when requirements, decisions, evidence and AI context live
in separate places. Mirai Graph treats the working system as an evolving graph:

- objects represent stable system state;
- relations make dependencies explicit;
- evidence links claims to sources;
- readiness records maturity and uncertainty;
- generated context packs provide task-specific AI context;
- governance gates separate suggestions, decisions and actions;
- profiles adapt the model to different domains.

In this framing, an AI employee is not just a prompt. It is a governed
graph-backed operating process: context, tools, policies, actions, results,
feedback and learning are connected through explicit state and approval
boundaries.

## Repository Map

```text
docs/          Concept, terminology, adoption and research guides.
standard/      Implementation-independent standard sections.
schemas/       Machine-readable schemas.
examples/      Public-safe examples and anti-examples.
templates/     Starter graph packages.
packages/      Reference CLI and validators.
playground/    Deterministic local demo report.
profiles/      Domain profiles.
pilots/        Public-safe pilot packages and reports.
publications/  Citation notes and publication materials.
releases/      Release notes and release process.
```

## Core Standard Areas

- [Object Model](standard/object-model.md)
- [Relation Model](standard/relation-model.md)
- [Lifecycle Readiness](standard/lifecycle-readiness.md)
- [Evidence Provenance](standard/evidence-provenance.md)
- [Context Pack Generation](standard/context-pack-generation.md)
- [Governance](standard/governance.md)
- [Hybrid Source Of Truth](standard/hybrid-source-of-truth.md)
- [Implementation Control](standard/implementation-control.md)
- [Process Control Contract](standard/process-control-contract.md)
- [Technology Quality Feedback](standard/technology-quality-feedback.md)
- [Character Layer Profile](profiles/character-layer/README.md)
- [Organization Governance](standard/organization-governance.md)

Additional standard sections, profiles, examples and research materials are
listed in the [Documentation Map](docs/README.md).

## Profiles

Current release-candidate profiles:

- [Software Specification](profiles/software-specification/README.md)
- [Project Management](profiles/project-management/README.md)
- [AI Employee](profiles/ai-employee/README.md)
- [Character Layer](profiles/character-layer/README.md)
- [Skill Runtime](profiles/skill-runtime/README.md)
- [Implementation Control](profiles/implementation-control/README.md)
- [Organization Governance](profiles/organization-governance/README.md)

Proposal/experimental profile:

- [Societal Governance](profiles/societal-governance/README.md)

## Validate And Explore

Common commands:

```bash
npx mirai-graph validate .
npx mirai-graph report validation .
npx mirai-graph choose-profile
npx mirai-graph report playground
```

Repository checkout checks:

```bash
npm test
npm run release:check
```

For the full command surface, see [Mirai Graph CLI](docs/adoption/cli.md) and
[Test Suite](standard/test-suite.md).

## Evidence Boundary

Mirai Graph validation checks graph package structure, profile rules, process
artifacts and public-safe examples. It does not prove that a project is correct,
scientifically validated, production-ready or authorized for release.

Generated context, evidence, feedback, cockpit metrics and proposals do not
authorize canonical updates by themselves. Controlled updates require explicit
governance gates.

## Release Candidate

The current release candidate consolidates the validator-backed public standard
across the core model, profiles, executable process control, instrumentation,
Character Layer, adopter kit and evidence boundaries.

See [v1.0.0-rc.1](releases/1.0.0-rc.1.md) and the
[Release Process](releases/README.md).

## What This Repository Is Not

This repository is not a dump of private research, company or client material.
Private project data, internal chats, internal skill sources, secrets and raw
customer or employee data do not belong here.

Synthetic examples and benchmarks are marked as synthetic. They support method
inspection and reproducibility, not broad external validity claims.

## License

- Code is licensed under the MIT License. See [LICENSE](LICENSE).
- Documentation is licensed separately. See [LICENSE-DOCS](LICENSE-DOCS).
