# Mirai Graph Roadmap

Status: 1.0 release-candidate roadmap

## Phase 0: Public Foundation

Goal: make the repository understandable, safe to open and ready for structured
growth.

1.0 RC status: implemented.

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

Goal: define the implementation-independent Mirai Graph standard.

1.0 RC status: implemented with notes. The repository now contains the core
object/relation/readiness/evidence/governance standard plus validator-backed
sections for graph seed, hybrid source of truth, profiles, implementation
control, routing control, source boundaries, recovery, risk, process control,
instrumentation and Character Layer.

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

Additional 1.0 RC artifacts now present:

- graph seed and graph embryo;
- hybrid source of truth;
- graph-as-AI-brain;
- action/runtime boundary;
- implementation-control cycles;
- launch record;
- work state machine;
- process-control contract;
- technology quality feedback;
- recovery/resume;
- risk-control matrix;
- multi-agent coordination;
- source-boundary contract;
- route explanation, fixtures, regression and federation health.
- development cockpit, feature implementation traceability and multi-source
  quality feedback;
- Character Layer profile, starter pack, integration evidence, portability
  evidence shape and 1.0 readiness artifact.

Readiness target:

`1_0_release_candidate_ready_with_notes` for public review and implementation
pilots.

## Phase 2: Method And Adoption Kit

Goal: help teams use Mirai Graph in real work.

1.0 RC status: implemented with notes. The current repository includes getting
started material, profile conformance fixtures, AI employee adoption, seed to
validated package tutorial, implementation-control examples, managed-project
examples, Character Layer adoption, starter templates and public-safe transfer
notes.

Planned artifacts:

- adoption guide;
- project profile;
- product profile;
- software-specification profile;
- organization-governance profile;
- human-AI system profile;
- implementation checklist;
- examples and anti-examples.

Post-1.0 gaps:

- final npm publication and GitHub Release execution after release-state
  approval;
- import/export helpers for starter packages;
- stronger non-software adoption recipes;
- external adopter feedback from independent pilots.

Implemented adopter-workflow focus:

- profile-selection guide;
- starter-template happy path;
- human-readable validation reports for adopter workflows;
- packaged adopter command sequence;
- organization-governance adoption report.

Initial implementation:

- `docs/adoption/choose-profile.md`;
- `mirai-graph choose-profile`;
- `mirai-graph adopter plan <role-or-profile>`;
- `mirai-graph adopter report <template-dir>`;
- `validate:adopter-workflow`.

## Phase 3: Reusable Tooling

Goal: make adoption practical for developers.

1.0 RC status: implemented with notes. The CLI validates packages, profiles,
context packs, graph seeds, implementation-control cycles, launch records,
process transitions, process-transition decision reports, process-control
contracts, technology quality feedback reports, DNA alignment, work state,
recovery, risk, coordination, source boundaries, routing-control examples and
baseline-comparison artifacts, instrumentation artifacts and Character Layer
readiness.

Planned artifacts:

- JSON schemas;
- validator;
- CLI package;
- reference context-pack generator;
- import/export helpers;
- test fixtures.

Post-1.0 gaps:

- package and publish the CLI as a cleaner public developer interface;
- add import/export helpers;
- extend human-readable reports beyond process-transition and instrumentation
  checks;
- add process-control explanation output and richer report formatting.
- add adoption recipes for technology quality feedback in non-software
  workflows.

Current tooling target:

```text
choose profile -> starter template -> validate -> report -> launch/evidence/kaizen
```

The standard must remain implementation-independent. Tooling validates and
demonstrates the standard; it does not replace the standard.

## Phase 4: Evidence And Playground

Goal: provide reproducible public-safe demonstrations.

1.0 RC status: implemented with notes. Synthetic benchmark, baseline-comparison
artifact, pilot packages, profile conformance results and runnable CLI examples
exist. The playground is a deterministic local report package rather than a
hosted interactive app.

Planned artifacts:

- synthetic context-reduction benchmark;
- benchmark runner;
- playground;
- semantic-completeness review protocol;
- limitations and threats-to-validity notes.

Post-1.0 gaps:

- separate synthetic evidence, pilot evidence and scientific claims more
  visibly;
- connect instrumentation reports to reproducibility packages and pilot
  protocols without exposing private runtime traces;
- add more independent implementation pilots;
- explore an interactive playground after CLI-first reports stabilize.

Synthetic materials must remain clearly separated from real-world validation.

## Phase 5: Publication And Ecosystem

Goal: connect the repository to research publications and external adoption.

1.0 RC status: early. Citation metadata, publication notes and evidence package
v0.3 exist, but the project still needs public publication records, stronger
reviewer protocols and external adoption evidence before making broad
scientific claims.

Planned artifacts:

- publication index;
- citation notes;
- reproducibility records;
- contributor guide;
- release process;
- public examples from approved external adopters.

## Near-Term Work After 1.0 RC

1. Execute the `1.0.0-rc.1` release: tag, GitHub Release and npm publication
   only after release-state checks are accepted.
2. Continue adopter workflow: import/export helper skeletons and richer report
   formatting when they directly support self-service adoption.
3. Add one or two external public-safe pilots maintained outside the original
   Mirai Graph authoring contour.
4. Expand organization-governance validation reports and adoption recipes.
5. Collect real multi-model Character Layer replay evidence before stronger
   portability claims.
6. Explore a local interactive playground only after deterministic report
   fixtures remain stable.
7. Turn evidence package v0.3 into a publication-ready reproducibility bundle.
