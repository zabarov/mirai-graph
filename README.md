# Mirai Graph

Make your project understandable to humans and AI.

Mirai Graph turns scattered project knowledge into a structured graph of
features, requirements, dependencies, risks, decisions, evidence and process
gates.

Use it when a software project has useful knowledge spread across README files,
docs, issues, chats, code comments and AI prompts, and you need a small
machine-readable map that developers and AI assistants can validate and reuse.

Status: public `1.0.0-rc.5` release candidate.

## What Problem Does It Solve?

- New developers need too much time to understand the project.
- AI assistants miss important constraints because context is scattered.
- Feature dependencies live in people's heads or old tickets.
- Requirements, implementation decisions and evidence are hard to trace.
- Work is marked "done" before the process, tests, review or evidence are clear.
- Project knowledge improves in chats but does not become reusable structure.
- AI-assisted work produces results without a durable trace of why a path was
  selected or blocked.

Mirai Graph gives the project a reviewable graph package: objects, relations and
gates that describe what exists, how it connects, what is blocked, what is
evidenced and what needs approval.

## What Can A Developer Do With It?

Start with a normal repository and use Mirai Graph to:

- detect whether the project already has a graph package;
- generate a bootstrap proposal without changing canonical graph files;
- create a starter graph for features, requirements, risks and decisions;
- validate the graph locally or in CI;
- give AI assistants a cleaner project map instead of dumping full docs into a
  prompt;
- grow the graph later into process control, AI employee workflows or
  organization governance.

## Current Installation Status

The repository is ready as a release candidate, but `mirai-graph@1.0.0-rc.5` is
not published on npm yet. Until npm publication is complete, use the repository
checkout path:

```bash
git clone https://github.com/zabarov/mirai-graph.git
cd mirai-graph
npm install
npm run release:check
```

After npm publication, external projects will use:

```bash
npm install -D mirai-graph
```

## Connect A Project In 10 Minutes

From the project you want to connect, the intended workflow is:

```bash
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
```

What each command does:

- `detect` is read-only and reports what kind of project you have.
- `bootstrap --mode suggest` creates proposal/evidence only.
- `init` creates starter graph files after you choose a profile.
- `validate` checks the graph package structure and profile rules.

If you are using a repository checkout before npm publication, run the same
commands through `node packages/cli/mirai-graph.js` from this repository.

## What Files Will Be Created?

For a typical software project, `init` creates:

```text
mirai-graph-package.json
graph/
  objects.json      # features, requirements, risks, decisions, evidence
  relations.json    # depends_on, implements, blocks, evidences, governs
gates/
  results.json      # validation and readiness checks
```

`bootstrap --mode suggest` creates proposal/evidence separately:

```text
mirai-graph/
  bootstrap-proposal/
    bootstrap-proposal.json
```

Generated proposals do not update canonical graph state by themselves.

For the guided path, use
[Connect A Project In 15 Minutes](docs/adoption/connect-project-15-minutes.md)
or the developer-focused guide
[Mirai Graph For Developers](docs/adoption/for-developers.md).

## What Should I Read First?

| If you are... | Start here | Then read |
| --- | --- | --- |
| Trying Mirai Graph in a project | [Connect A Project In 15 Minutes](docs/adoption/connect-project-15-minutes.md) | [Mirai Graph For Developers](docs/adoption/for-developers.md), [CLI](docs/adoption/cli.md) |
| A developer integrating validation | [Mirai Graph For Developers](docs/adoption/for-developers.md) | [Developer Integration Guide](docs/adoption/developer-integration-guide.md), [Test Suite](standard/test-suite.md) |
| A researcher evaluating the model | [Scientific Evidence Package](docs/research/scientific-evidence-package.md) | [Practice And Science Program](docs/research/practice-science-program.md), [Publications](publications/README.md) |
| Building an AI employee | [AI Employee Graph Adoption](docs/adoption/ai-employee-graph.md) | [Character Layer Adoption](docs/adoption/character-layer.md), [Graph As AI Brain](standard/graph-as-ai-brain.md) |
| Managing an organization or program | [Organization Governance](standard/organization-governance.md) | [Project Management Profile](profiles/project-management/README.md), [Process Control Contract](standard/process-control-contract.md) |
| Looking for the full map | [Documentation Map](docs/README.md) | [Roadmap](ROADMAP.md), [Release Process](releases/README.md) |

## How It Helps AI Assistants

LLMs are useful, but they depend on the context they receive. If the project
context is incomplete, the assistant can miss constraints, invent assumptions or
ignore the team's working process.

Mirai Graph gives AI assistants structured context:

- stable objects instead of loose paragraphs;
- explicit dependency and evidence links;
- readiness and uncertainty;
- process gates that separate suggestion, approval and action;
- technology-quality feedback when work did not follow the declared process.

In this framing, an AI employee is not just a prompt. It is a governed process:
context, tools, policies, actions, results, feedback and learning are connected
through explicit state and approval boundaries.

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
- [Profile Boundaries](standard/profile-boundaries.md)
- [Implementation Control](standard/implementation-control.md)
- [Process Control Contract](standard/process-control-contract.md)
- [Technology Quality Feedback](standard/technology-quality-feedback.md)
- [Dynamic Episode Layer](standard/dynamic-episode-layer.md)
- [Semantic Intent Resolution](standard/semantic-intent-resolution.md)
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

Proposal/experimental standard layer:

- [Dynamic Episode Layer](standard/dynamic-episode-layer.md)
- [Episode Trace](standard/episode-trace.md)
- [Dynamic Layer For AI-Assisted Code Generation](standard/dynamic-layer-code-generation.md)

## Validate And Explore

Common commands:

```bash
npx mirai-graph validate .
npx mirai-graph report validation .
npx mirai-graph report dynamic-episode examples/dynamic-episode-minimal/results/dynamic-episode-trace.json
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

Mirai Graph also does not store bulk source content as canonical graph state.
Documents, code, CMS records, tickets and databases remain source systems. The
graph stores governable meaning: object ids, relations, summaries, source refs,
evidence refs, owners, readiness, gates, decisions, episode metadata and Kaizen
routes. See [Profile Boundaries](standard/profile-boundaries.md).

## Release Candidate

The current release candidate consolidates the validator-backed public standard
across the core model, profiles, executable process control, instrumentation,
Character Layer, Dynamic Episode tracing, adopter kit and evidence boundaries.

See [v1.0.0-rc.5](releases/1.0.0-rc.5.md) and the
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
