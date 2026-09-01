# Mirai

Make complex work explicit, executable and auditable for humans and AI.

Mirai 2.0 combines **Mirai Graph Core** with a typed process language and a
governed runtime. The graph describes goals, knowledge, dependencies, risks,
policies and evidence. A Mirai Program describes the bounded decisions and
steps that may be performed. The runtime can execute only authorized effects
and records a replayable episode.

Use it when a software project has useful knowledge spread across README files,
docs, issues, chats, code comments and AI prompts, and you need a small
machine-readable map that developers and AI assistants can validate and reuse.

Status: `2.0.0-alpha.2` development branch. The stable compatibility line is
`mirai-graph@1.4.1`.

## Mirai 2.0 Preview

The second 2.0 alpha provides deterministic Mirai Program compilation, static
validation, a pure reference interpreter, replay and a portable language
conformance corpus. It does **not** execute repository, workspace or other
external effects yet.

```bash
npm install
npm run build
node packages/cli/mirai.js program validate examples/mirai-program-minimal/program.mirai.yaml
node packages/cli/mirai.js compile examples/mirai-program-minimal/program.mirai.yaml --out /tmp/program.mirai.json
node packages/cli/mirai.js simulate examples/mirai-program-minimal/program.mirai.yaml --input examples/mirai-program-minimal/input-approved.json
node packages/cli/mirai.js conformance run conformance/corpus/pure/corpus.json
```

Read [Mirai Program](standard/mirai-program.md), the
[2.0 architecture decisions](docs/architecture/mirai-2.0-decisions.md) and the
[1.4 migration guide](docs/adoption/migrate-1.4-to-2.0.md) before adopting the
alpha runtime contracts.

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

## Stable 1.4 Installation

The published stable line remains `mirai-graph@1.4.1`. To verify that release
from its tag, use:

```bash
git clone --branch v1.4.1 https://github.com/zabarov/mirai-graph.git
cd mirai-graph
npm install
npm run release:check
```

Existing projects use:

```bash
npm install -D mirai-graph
```

Mirai 2.0 will publish the primary package as `@zabarov/mirai`; the
`mirai-graph` package and CLI names remain compatibility wrappers throughout
the 2.x line. Product, manifest, Program and Runtime contracts are versioned
independently. See [Versioning](docs/versioning.md).

## Connect A Project In 10 Minutes

From the project you want to connect, the intended workflow is:

```bash
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
npx mirai-graph migrate .
```

What each command does:

- `detect` is read-only and reports what kind of project you have.
- `bootstrap --mode suggest` creates proposal/evidence only.
- `init` creates starter graph files after you choose a profile.
- `validate` checks the graph package structure and profile rules.
- `migrate` shows a read-only plan; add `--apply` only after reviewing it.

If you are using a repository checkout before npm publication, run the same
commands through `node packages/cli/mirai-graph.js` from this repository.

## Project Technology

Project Technology is the executable part of Mirai Graph. It gives ordinary
projects, skills, platforms and federations one safe way to build task context,
bind an accepted target and verify that work still follows it.

Enable it in the existing root manifest:

```json
{
  "extensions": {
    "mirai.project_technology": {
      "contract_version": "1.0.0",
      "enabled": true,
      "context_policy": "task_scoped",
      "source_boundary": "hybrid_sot",
      "continuity_policy": "task_boundary"
    }
  }
}
```

Read-only operations never need `--apply`:

```bash
mirai-graph technology explain .
mirai-graph technology status .
mirai-graph technology context . --task "implement the approved feature"
mirai-graph technology verify . --significant-work
```

For deeper graphs, the same `context` operation supports four read-only phases:

```bash
mirai-graph technology context . --phase discover --task "implement the approved feature"
mirai-graph technology context . --phase expand --input receipt.json --select capability.delivery
mirai-graph technology context . --phase compile --input receipt.json --selection selection.json
mirai-graph technology context . --phase verify --packet context-pack.json --evidence usage-evidence.json
```

`discover` returns a bounded top-level choice. `expand` follows only selected
branches. `compile` adds every required process, constraint and validator, and
returns an immutable context pack only when the selection is complete.
`verify` proves that required sources influenced a decision and a checked
outcome; merely loading a document is not enough.

The programmatic API exposes the same operations as `discoverContext`,
`expandContext`, `compileContext` and `verifyContext`. Mirai Graph does not call
or depend on a particular AI model.

Verified project experience can be saved without storing a chat transcript:

```bash
mirai-graph technology sync . --boundary task_complete --evidence continuity-evidence.json
mirai-graph technology sync . --boundary task_complete --evidence continuity-evidence.json --apply
```

Accepted facts and reusable cases live in `graph/specs`; mutable receipts and
rollback data stay host-local. The same contract works in Git repositories and
ordinary shared folders.

Project Technology can also preserve immutable releases of file bundles:

```bash
mirai-graph technology artifact inspect . --input incoming.zip
mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound
mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound --apply
mirai-graph technology artifact compare . --matter-id agreement-main --base-release 20260828-01 --target-release 20260828-02
mirai-graph technology artifact verify . --matter-id agreement-main --release-id 20260828-02
```

The protected files remain outside graph data. The graph keeps only safe
identity, lineage, state, references and checksums. Mirai Graph performs
technical integrity checks; a domain owner decides what a version means.

Large operational methods can be described once as executable technologies and
compiled into staff courses without maintaining a second semantic copy:

```bash
mirai-graph technology course compile . --technology graph/specs/technology.json
mirai-graph technology course compile . --technology graph/specs/technology.json --scenario scenario.recovery
mirai-graph technology course verify . --course-pack course-pack.json
mirai-graph technology course reconcile . --course-pack course-pack.json --projection edited-course.json
```

An executable technology contains reusable operations, their prerequisites,
inputs, outputs, stop conditions, rollback paths, checks and raw source refs.
Scenarios select the operations needed for a complete or partial outcome.
Compilation restores every required dependency. Reconciliation is read-only:
editorial differences go to the documentation owner, while changed execution
or safety rules become proposals to the technology owner.

Changing operations return a preview unless `--apply` is explicit. See
[Project Technology](standard/project-technology.md) for provider/consumer
binding, local state and safety boundaries.

## What Files Will Be Created?

For a typical software project, `init` creates:

```text
graph.json
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
- [Goal Vector Quality Control](standard/goal-vector-quality-control.md)
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

The stable 1.0 release consolidates the validator-backed public standard
across the core model, profiles, executable process control, instrumentation,
Character Layer, adopter kit and evidence boundaries.

`1.0.0-rc.6` specifically presents the anti-drift / quality-control contour as
one coherent review surface:

```text
semantic intent
-> process and technology control
-> dynamic episode trace
-> goal-vector reverse audit
-> technology quality feedback
-> Kaizen / replay / regression candidate
```

See [v1.0.0-rc.6](releases/1.0.0-rc.6.md) and the
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
