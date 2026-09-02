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

Status: Mirai 2.1 stable software release prepared for production-read use.
Production-write authority remains deployment-specific and separately gated.

The machine-readable [2.1 release readiness report](releases/2.1.0-readiness.json)
separates engineering release gates from scientific claims and production-write
authority. A green local suite therefore does not by itself authorize stable
promotion or live effects.

### Production Readiness

Mirai readiness is target-specific, not a single yes/no label:

- `development` and `sandbox`: ready for local experimentation and controlled
  no-effect runs;
- `production_read`: eligible after the deployment-specific readiness profile
  is completed and reviewed;
- `production_write`: remains deployment-specific and blocked until the target
  has an approved security profile, operator recovery evidence, bounded
  capabilities and deployment-owner approval;
- live network, secret-changing, financial and public-publishing effects remain
  outside the reference runtime.

See the [production-readiness standard](standard/production-readiness.md),
[operations contract](docs/operations/mirai-production-operations.md),
[internal security baseline](docs/security/mirai-internal-security-baseline-2026-09-01.md)
and [external review packet](docs/security/mirai-independent-security-review-packet.md).
Passing repository tests is necessary engineering evidence, but is not by
itself authorization to run against a production target.

## Mirai 2.1 Stable

Mirai 2.1 includes the security-frozen Mirai 2.0 Program and Runtime core plus
additive graph-native capabilities. It adds:

- read-only Files/Git source catalogs and proposal-only knowledge assimilation;
- graph-native components with interfaces, typed operations and contextual
  program bindings;
- multidimensional relation facts with scope, time, authority and provenance;
- a reviewable `technology_draft` between human text and Mirai Program;
- immutable, digest-bound activation plans, deterministic parallel simulation
  and durable no-effect execution through the Mirai 2.0 governed runtime;
- a public-safe Federation pilot and an independent Python checker for
  activation plans and run evidence;
- a self-describing Project Capsule under `mirai/`, with deterministic lock,
  generated START and task-scoped Agent Execution Brief.

```bash
mirai source scan . --out /tmp/source-catalog.json
mirai assimilate /tmp/source-catalog.json --out /tmp/graph-proposal.json
mirai technology extract technology.yaml --out /tmp/technology-draft.json
mirai technology compile /tmp/technology-draft.json --out /tmp/program.mirai.json
mirai component validate component-package.json
mirai activation plan --graph graph-snapshot.json --signal signal.json --out /tmp/activation-plan.json
mirai activation simulate /tmp/activation-plan.json
mirai activation run /tmp/activation-plan.json --base-dir . --sandbox /tmp/mirai-sandbox
mirai project detect . --markdown
mirai project inspect . --for-agent --task "review the current change"
```

Read the [2.1 architecture](docs/architecture/mirai-2.1-graph-native-intelligence.md).
Ingestion and extraction never perform canonical apply. The runtime executes
only immutable activation plans and existing capability-gated Mirai Programs.

## Mirai 2.0 Preview

The third 2.0 alpha adds a capability-gated, host-local reference runtime to
the deterministic compiler and pure interpreter. It supports repository and
Git reads, sandboxed workspace patches, allowlisted test commands, explicit
human approvals, durable receipts, recovery, compensation, replay with effect
stubs and sanitized evidence export. Network, production, secret-changing,
financial and public-publishing adapters remain outside the 2.0 core.

```bash
npm install
npm run build
node packages/cli/mirai.js program validate examples/mirai-program-minimal/program.mirai.yaml
node packages/cli/mirai.js compile examples/mirai-program-minimal/program.mirai.yaml --out /tmp/program.mirai.json
node packages/cli/mirai.js simulate examples/mirai-program-minimal/program.mirai.yaml --input examples/mirai-program-minimal/input-approved.json
node packages/cli/mirai.js conformance run conformance/corpus/pure/corpus.json
node packages/cli/mirai.js run examples/mirai-governed-runtime-minimal/results/program.mirai.json \
  --input examples/mirai-governed-runtime-minimal/input.json \
  --sandbox examples/mirai-governed-runtime-minimal/sandbox
npm run test:mirai-property-fuzz
npm run validate:mirai-release-readiness
```

Read [Mirai Program](standard/mirai-program.md), the
[capability and effects contract](standard/mirai-capabilities-and-effects.md),
[durable execution contract](standard/mirai-durable-execution.md), the
[2.0 architecture decisions](docs/architecture/mirai-2.0-decisions.md) and the
[1.4 migration guide](docs/adoption/migrate-1.4-to-2.0.md) before adopting the
alpha runtime contracts.

For a runnable path, use the
[governed runtime tutorial](docs/adoption/mirai-2-governed-runtime-tutorial.md).
The [API reference](docs/reference/mirai-2-api.md),
[operations guide](docs/operations/mirai-runtime-operations-guide.md) and
[threat model](docs/security/mirai-runtime-threat-model.md) define the current
integration and safety boundary.

Programs declare effects but cannot authorize them. Workspace writes require
`--apply` and a signed host-local approval receipt. A completed episode is
evidence, not permission to update canonical graph state.

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

Start with a normal repository and use Mirai to:

- detect whether the project already has a graph package;
- generate a bootstrap proposal without changing canonical graph files;
- create a self-describing Project Capsule and starter graph for features,
  requirements, risks and decisions;
- validate the graph locally or in CI;
- give AI assistants a cleaner project map instead of dumping full docs into a
  prompt;
- grow the graph later into process control, AI employee workflows or
  organization governance.

## Stable 2.1 Installation

Install the primary stable package:

```bash
mkdir mirai-stable-check && cd mirai-stable-check
npm init -y
npm install @zabarov/mirai@2.1.0
npx mirai --version
```

Existing Mirai Graph projects may use the compatibility package. It resolves
to the same 2.1 runtime and preserves the `mirai-graph` CLI aliases:

```bash
npm install -D mirai-graph@2.1.0
npx mirai-graph --version
```

The primary package is `@zabarov/mirai`; the `mirai-graph` package and CLI
names remain compatibility wrappers throughout the 2.x line. Product,
manifest, Program and Runtime contracts are versioned independently. See
[Versioning](docs/versioning.md).

## Connect A Project In 10 Minutes

From the project you want to connect, the intended workflow is:

```bash
npx mirai-graph project detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph project init . --profile software_specification
npx mirai-graph project inspect . --for-agent --task "review this project"
npx mirai-graph validate .
npx mirai-graph project migrate . --from graph-v2 --dry-run
```

What each command does:

- `detect` is read-only and reports what kind of project you have.
- `bootstrap --mode suggest` creates proposal/evidence only.
- `init` creates `mirai/`, a verified lock and the 2.x compatibility facade.
- `inspect --for-agent` returns a compact task-scoped execution brief.
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

Accepted facts and reusable cases live in `mirai/graph/specs`; mutable receipts
and rollback data stay host-local under `.mirai/`. Legacy `graph/specs` remains
readable during the 2.x compatibility window.

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
mirai-graph technology course compile . --technology mirai/graph/specs/technology.json
mirai-graph technology course compile . --technology mirai/graph/specs/technology.json --scenario scenario.recovery
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
mirai/
  manifest.yaml
  manifest.lock.json
  START.md
  owner-notes.md
  graph/
    objects.json
    relations.json
  programs/
  policies/
  sources.yaml
.mirai/             # ignored local runs, receipts, evidence and backups
```

`bootstrap --mode suggest` creates proposal/evidence separately:

```text
.mirai/
  proposals/
    bootstrap-proposal.json
```

Generated proposals do not update canonical graph state by themselves.
The root `graph.json` is a generated 2.x compatibility facade pointing to
`mirai/graph/`; it is not a second source of truth. See the
[Project Capsule standard](standard/project-capsule.md).

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

Current stable profiles:

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

## Release History

Mirai 2.1 is the current stable release. It combines the security-frozen Mirai
2.0 Program and Runtime core with the graph-native 2.1 contracts, Project
Capsule and compatibility package.

The earlier 1.0 line established the anti-drift and quality-control contour:

```text
semantic intent
-> process and technology control
-> dynamic episode trace
-> goal-vector reverse audit
-> technology quality feedback
-> Kaizen / replay / regression candidate
```

See the [release history and process](releases/README.md).

## What This Repository Is Not

This repository is not a dump of private research, company or client material.
Private project data, internal chats, internal skill sources, secrets and raw
customer or employee data do not belong here.

Synthetic examples and benchmarks are marked as synthetic. They support method
inspection and reproducibility, not broad external validity claims.

## License

- Code is licensed under the MIT License. See [LICENSE](LICENSE).
- Documentation is licensed separately. See [LICENSE-DOCS](LICENSE-DOCS).
