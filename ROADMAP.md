# Mirai Graph Roadmap

Status: published 1.4.0 compatibility line and Mirai 2.1.0-rc.1 release track

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
- profile boundaries and the extension-before-profile rule;
- graph-as-AI-brain;
- action/runtime boundary;
- implementation-control cycles;
- launch record;
- work state machine;
- process-control contract;
- technology quality feedback;
- semantic intent resolution;
- goal vector quality control;
- recovery/resume;
- risk-control matrix;
- multi-agent coordination;
- source-boundary contract;
- route explanation, fixtures, regression and federation health.
- development cockpit, feature implementation traceability and multi-source
  quality feedback;
- Character Layer profile, starter pack, integration evidence, portability
  evidence shape and 1.0 readiness artifact.
- proposal/experimental Dynamic Episode Layer, episode trace schema and
  synthetic code-generation trace example;
- `1.0.0-rc.6` anti-drift / quality-control contour that connects semantic
  intent, process control, dynamic episode tracing, goal-vector reverse audit,
  technology quality feedback and Kaizen/replay follow-up.

Readiness target:

`1_0_release_candidate_ready_with_notes` for public review and implementation
pilots.

## Phase 2: Method And Adoption Kit

Goal: help teams use Mirai Graph in real work.

1.0 RC status: implemented with notes. The current repository includes
npm-first self-service onboarding, getting started material, profile
conformance fixtures, AI employee adoption, seed to validated package tutorial,
implementation-control examples, managed-project examples, Character Layer
adoption, starter templates and public-safe transfer notes.

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
- sanitized pilot/replay evidence for the anti-drift contour before claiming
  real-world drift reduction.

Implemented adopter-workflow focus:

- profile-selection guide;
- starter-template happy path;
- human-readable validation reports for adopter workflows;
- packaged adopter command sequence;
- organization-governance adoption report.
- self-service onboarding with `detect`, `bootstrap` and `init`;
- 15-minute project connection tutorial;
- GitHub Action starter for validation.

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

- publish the prepared CLI package after release-state approval;
- add import/export helpers;
- extend human-readable reports beyond process-transition and instrumentation
  checks;
- add process-control explanation output and richer report formatting.
- add adoption recipes for technology quality feedback in non-software
  workflows.
- evolve dynamic episode traces from synthetic validation to replay/regression
  support for internal pilots.
- add optional validator/report warnings for profile overlap and bulk-content
  drift.

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
- add dynamic episode trace datasets for public-safe code-generation drift
  experiments;
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

## Mirai 2.0 Core Track

The repository `1.4.1` maintenance line remains the declarative compatibility
baseline; npm currently publishes `mirai-graph@1.4.0`. Mirai
2.0 developed the governed execution core without replacing Hybrid SOT or
treating graph content as runtime authorization. That core is now frozen at an
exact reviewed revision and included in Mirai 2.1.0-rc.1; a separate stable
2.0 package was not published.

Release sequence and current status:

1. `2.0.0-alpha.1`: implemented on the 2.0 development branch: typed Mirai
   Program contracts, deterministic compiler, static simulation and
   proposal-only migration reports;
2. `2.0.0-alpha.2`: implemented on the 2.0 development branch: pure
   deterministic interpreter, replay, execution budgets and portable language
   conformance corpus;
3. `2.0.0-alpha.3`: implemented on the 2.0 development branch:
   capability-gated reference adapters, durable receipts and checkpoints,
   effect-stub replay, recovery, compensation and sanitized evidence export;
4. `2.0.0-beta.1`: engineering pilot and independent-checker package is
   complete; property/fuzz and machine-readable readiness gates are also in
   place, while promotion awaits blinded external review and a variance pilot;
5. API freeze, isolated security review, observed cross-platform CI and
   clean-room installation: completed as the 2.1 RC foundation;
6. stable execution core: delivered through the unified 2.1 release line.

The existing `graph.json` manifest contract is already `2.0.0`; that number is
not the product release number. New Mirai Program and Runtime contracts have
their own versions.

## Mirai 2.1 Graph-Native Intelligence Track

This track is additive: Mirai Program `1.0.0` and Runtime contracts remain
unchanged while graph-native contracts and Project Capsule are added.

1. `2.1.0-alpha.1`: source catalog, Files/Git scanning, fingerprints,
   provenance, duplicate/conflict classification and proposal-only assimilation;
2. `2.1.0-alpha.2`: interfaces, component types and instances, explicit
   operation bindings and multidimensional relation facts;
3. `2.1.0-alpha.3`: technology draft, source spans, ambiguity diagnostics and
   deterministic compilation to Mirai Program;
4. `2.1.0-alpha.4`: graph context resolver, immutable activation plans,
   inhibitors, budgets, explanations and deterministic simulation;
5. `2.1.0-beta.1`: durable parallel activation through the existing Mirai 2.0
   Runtime plus the controlled Federation pilot;
6. `2.1.0-rc.1`: independent checker extension, security review, contract
   freeze and clean-room installation;
7. `2.1.0`: stable after conformance, safety, compatibility, pilot and exact RC
   package gates pass. Confirmatory science remains required for comparative
   effectiveness claims, not for bounded software release claims.

Project Capsule is an additive core-infrastructure track within 2.1: preferred
`mirai/` layout, deterministic project lock, generated START, task-scoped Agent
Execution Brief, graph-v2 migration and a 2.x root compatibility facade. It is
not a new profile and does not change Program `1.0.0` or Runtime `1.0.0`.

The release candidate now covers the full public contract inventory, durable
no-effect activation, controlled Federation/Larena-shaped/AI Employee pilots,
independent Python conformance, production-read operations, exact-revision
isolated security review and public cross-platform CI. Stable promotion still
requires an exact RC package clean-room matrix and final release metadata.

Current promotion truth is recorded in
[`releases/2.1.0-readiness.json`](releases/2.1.0-readiness.json). This report is
validated in `npm test`; non-passed mandatory gates keep the overall state
blocked rather than being hidden behind a green engineering suite.

## Near-Term Work After 1.4

1. Validate sequential context traversal in independent adopter projects and
   collect public-safe compatibility evidence.
2. Continue adopter workflow with richer reports and domain-neutral recipes.
3. Add external public-safe pilots maintained outside the original Mirai Graph
   authoring contour.
4. Collect real multi-model replay evidence before stronger effectiveness or
   portability claims.
5. Keep the deterministic CLI and public contracts stable while improving
   ranking as a replaceable client-side concern.
