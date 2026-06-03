# GrowGraph Roadmap

Status: draft

## Phase 0: Public Foundation

Goal: make the repository understandable, safe to open and ready for structured
growth.

Alpha status: implemented for public alpha.

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

Alpha status: partially implemented. The repository now contains the core
object/relation/readiness/evidence/governance standard plus alpha drafts for
graph seed, hybrid source of truth, profiles, implementation control, routing
control, source boundaries, recovery, risk and process control.

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

Additional alpha artifacts now present:

- graph seed and graph embryo;
- hybrid source of truth;
- graph-as-AI-brain;
- action/runtime boundary;
- implementation-control cycles;
- launch record;
- work state machine;
- process-control contract;
- recovery/resume;
- risk-control matrix;
- multi-agent coordination;
- source-boundary contract;
- route explanation, fixtures, regression and federation health.

Readiness target:

`standard_ready_with_notes` for internal and public implementation pilots.

## Phase 2: Method And Adoption Kit

Goal: help teams use GrowGraph in real work.

Alpha status: partially implemented. The current repository includes getting
started material, profile conformance fixtures, AI employee adoption, seed to
validated package tutorial, implementation-control examples, managed-project
examples and public-safe transfer notes.

Planned artifacts:

- adoption guide;
- project profile;
- product profile;
- software-specification profile;
- organization-governance profile;
- human-AI system profile;
- implementation checklist;
- examples and anti-examples.

Next gaps:

- clearer role-based adoption journeys;
- organization-governance validation reports and richer adoption recipes;
- concise recipes for choosing the right profile and conformance level.

## Phase 3: Reusable Tooling

Goal: make adoption practical for developers.

Alpha status: partially implemented. The CLI validates packages, profiles,
context packs, graph seeds, implementation-control cycles, launch records,
process transitions, process-transition decision reports, process-control
contracts, DNA alignment, work state, recovery, risk, coordination, source
boundaries, routing-control examples and baseline-comparison artifacts.

Planned artifacts:

- JSON schemas;
- validator;
- CLI package;
- reference context-pack generator;
- import/export helpers;
- test fixtures.

Next gaps:

- package the CLI as a cleaner public developer interface;
- add import/export helpers;
- extend human-readable reports beyond process-transition checks;
- add process-control explanation output and richer report formatting.

The standard must remain implementation-independent. Tooling validates and
demonstrates the standard; it does not replace the standard.

## Phase 4: Evidence And Playground

Goal: provide reproducible public-safe demonstrations.

Alpha status: partially implemented. Synthetic benchmark, baseline-comparison
artifact, pilot packages, profile conformance results and runnable CLI examples
exist. The playground is a deterministic local report package rather than a
hosted interactive app.

Planned artifacts:

- synthetic context-reduction benchmark;
- benchmark runner;
- playground;
- semantic-completeness review protocol;
- limitations and threats-to-validity notes.

Next gaps:

- separate synthetic evidence, pilot evidence and scientific claims more
  visibly;
- add more independent implementation pilots;
- explore an interactive playground after CLI-first reports stabilize.

Synthetic materials must remain clearly separated from real-world validation.

## Phase 5: Publication And Ecosystem

Goal: connect the repository to research publications and external adoption.

Alpha status: early. Citation metadata and publication notes exist, but the
project still needs public publication records, stronger reproducibility
packages and external adoption evidence before making broad scientific claims.

Planned artifacts:

- publication index;
- citation notes;
- reproducibility records;
- contributor guide;
- release process;
- public examples from approved external adopters.

## Near-Term Work

1. Prepare the next alpha around process-control explanations, import/export
   helpers and cleaner CLI packaging.
2. Add one or two external public-safe pilots maintained outside the original
   GrowGraph authoring contour.
3. Expand organization-governance validation reports and adoption recipes.
4. Explore a local interactive playground only after deterministic report
   fixtures remain stable.
5. Expand scientific evidence packages with independent validation and
   limitations.
