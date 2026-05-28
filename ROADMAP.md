# GrowGraph Roadmap

Status: draft

## Phase 0: Public Foundation

Goal: make the repository understandable, safe to open and ready for structured
growth.

Done when:

- README exists;
- repository purpose is documented;
- license strategy is explicit;
- citation metadata exists;
- initial concept and terminology exist;
- no private source material is present.

Initial artifacts:

- `README.md`
- `docs/repository-purpose.md`
- `docs/concept.md`
- `docs/terminology.md`
- `ROADMAP.md`
- `LICENSE`
- `LICENSE-DOCS`
- `CITATION.cff`

## Phase 1: Standard Draft

Goal: define the implementation-independent GrowGraph standard.

Planned artifacts:

- `standard/standard-v0.1.md`
- `standard/object-model.md`
- `standard/relation-model.md`
- `standard/lifecycle-readiness.md`
- `standard/evidence-provenance.md`
- `standard/context-pack-generation.md`
- `standard/governance.md`
- `standard/profiles.md`
- `standard/conformance-levels.md`
- `standard/test-suite.md`

Readiness target:

`standard_ready_with_notes` for internal and public implementation pilots.

## Phase 2: Method And Adoption Kit

Goal: help teams use GrowGraph in real work.

Planned artifacts:

- adoption guide;
- project profile;
- product profile;
- software-specification profile;
- organization-governance profile;
- human-AI system profile;
- implementation checklist;
- examples and anti-examples.

## Phase 3: Reusable Tooling

Goal: make adoption practical for developers.

Planned artifacts:

- JSON schemas;
- validator;
- CLI package;
- reference context-pack generator;
- import/export helpers;
- test fixtures.

The standard must remain implementation-independent. Tooling validates and
demonstrates the standard; it does not replace the standard.

## Phase 4: Evidence And Playground

Goal: provide reproducible public-safe demonstrations.

Planned artifacts:

- synthetic context-reduction benchmark;
- benchmark runner;
- playground;
- semantic-completeness review protocol;
- limitations and threats-to-validity notes.

Synthetic materials must remain clearly separated from real-world validation.

## Phase 5: Publication And Ecosystem

Goal: connect the repository to research publications and external adoption.

Planned artifacts:

- publication index;
- citation notes;
- reproducibility records;
- contributor guide;
- release process;
- public examples from approved external adopters.

## Near-Term Work

1. Map practical `$graph` capabilities to public GrowGraph standard sections.
2. Add context-pack relevance scoring and selection explanations.
3. Add semantic completeness review fixture/result for the benchmark and pilot context packs.
4. Add positive profile conformance fixture documentation.
5. Add GitHub release notes publication process.
6. Prepare v0.1.0-alpha.3 scope.
