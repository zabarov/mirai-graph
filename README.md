# GrowGraph

GrowGraph is an evolutionary graph operating model for managing the growth of
complex systems.

It defines how projects, products, organizations and human-AI systems can use
canonical graph state, generated context packs, evidence, readiness and
governance gates to coordinate knowledge, decisions and action.

## Why GrowGraph

Many teams use documents, chats, task trackers and isolated knowledge bases as
their main working substrate. This becomes fragile when the system grows:
requirements change, decisions depend on each other, evidence is scattered and
AI assistants receive incomplete context.

GrowGraph treats the working system as an evolving graph:

- objects represent the system state;
- relations make dependencies explicit;
- evidence links claims to sources;
- readiness records maturity and uncertainty;
- generated context packs provide task-specific AI context;
- governance gates separate suggestions, decisions and actions;
- profiles adapt the model to domains without changing the core standard.

## Current Status

Status: early public foundation.

This repository is being prepared as the public source of truth for the
GrowGraph model, standard, methods, examples and reproducibility materials.

The model is related to the `Evolutionary Object Graph (EOG)` research program.
The current public name is `GrowGraph`; `EOG` remains the scientific continuity
term for earlier preprint materials.

## Intended Audiences

- Researchers who need a clear model, reproducible experiments and citation
  trail.
- Developers who need schemas, validators, examples and integration methods.
- Product teams that need adoption guides, profiles and operating procedures.
- Organizations that need governance patterns for complex human-AI systems.

## Repository Map

```text
docs/         Concept, terminology, methodology and adoption guides.
standard/     Implementation-independent standard sections.
schemas/      Machine-readable schemas and validation rules.
benchmarks/   Synthetic benchmarks and reproducibility packages.
examples/     Public-safe examples and anti-examples.
packages/     Reference tooling, libraries and CLI packages.
playground/   Interactive or runnable demonstrations.
publications/ Publication links, citation notes and reproducibility records.
```

## Start Here

- [Repository Purpose](docs/repository-purpose.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Concept](docs/concept.md)
- [Terminology](docs/terminology.md)
- [Getting Started](docs/adoption/getting-started.md)
- [Practice And Science Program](docs/research/practice-science-program.md)
- [Standard Gap Report](docs/transfer/standard-gap-report-2026-05-28.md)
- [Standard v0.1 Draft](standard/standard-v0.1.md)
- [Conformance Levels](standard/conformance-levels.md)
- [Test Suite](standard/test-suite.md)
- [Synthetic Context-Reduction Benchmark](benchmarks/synthetic-context-reduction-v0/README.md)
- [Benchmark Result](benchmarks/synthetic-context-reduction-v0/RESULT.md)
- [Minimal Graph Example](examples/minimal-graph/README.md)

## Validate A Graph Package

Run the initial validator:

```bash
node packages/cli/validate-growgraph.js examples/minimal-graph
node packages/cli/validate-growgraph.js benchmarks/synthetic-context-reduction-v0
```

Or run the current smoke checks:

```bash
npm test
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
