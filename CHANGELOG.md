# Changelog

All notable changes to Mirai Graph will be documented in this file.

## [Unreleased]

## [1.0.0-rc.6] - 2026-06-27

### Added

- Release consolidation notes for the anti-drift / quality-control contour that
  connects Semantic Intent Resolution, Dynamic Episode tracing, Goal Vector
  Quality Control and Technology Quality Feedback.
- Publication foundation package for Semantic Intent and Goal-Vector Control.
- Publication foundation package for Observable Self-Correcting AI Workflows.

### Changed

- Working package version is now `1.0.0-rc.6`.
- README, release index and evidence package now describe the consolidated
  anti-drift contour as a review surface instead of separate isolated features.
- Publications index now separates the two article candidates and their evidence
  requirements.

### Claim Boundary

- This release candidate consolidates already validator-backed public shapes and
  publication scaffolds.
- It does not claim peer-reviewed effectiveness, real-world drift reduction,
  production autonomous execution safety or authorization from traces, evidence,
  feedback, goal vectors, semantic confidence or proposals.

## [1.0.0-rc.5] - 2026-06-27

### Added

- Semantic Intent Resolution standard as an input-control extension contract.
- Semantic intent schema, synthetic positive example and negative fixtures for
  low-confidence execution and proposal-as-canonical-update violations.
- CLI validation support for `semantic-intent-resolution`.
- Goal Vector Quality Control standard as a quality-control extension contract.
- Goal-vector schema, synthetic positive example and negative fixtures for
  missing vector links, false completion, tests-as-acceptance, missing reverse
  audit and correction-without-route violations.
- CLI validation support for `goal-vector-quality-control`.

### Changed

- Working package version is now `1.0.0-rc.5`.
- README, documentation map and release index now list Semantic Intent
  Resolution and Goal Vector Quality Control as part of the release-candidate
  standard surface.
- `npm test` includes Semantic Intent Resolution and Goal Vector Quality
  Control positive and negative checks.

### Claim Boundary

- This release validates the public shape and safety boundaries of Semantic
  Intent Resolution.
- It does not claim production readiness, automatic correct process selection,
  live-action authorization or canonical updates from generated briefs,
  proposals, evidence, reverse audits, goal vectors or semantic confidence.

## [1.0.0-rc.4] - 2026-06-16

### Added

- Proposal/experimental Dynamic Episode Layer standard documents.
- Dynamic episode trace schema, synthetic positive fixture and negative
  fixtures for unsafe canonical-write, evidence-as-authorization, missing
  event, missing selected path and unclassified finding cases.
- CLI validation and report support for `dynamic-episode-trace`.

### Changed

- Working package version is now `1.0.0-rc.4`.
- README, roadmap, release index, test-suite docs and evidence package now
  reflect Dynamic Episode tracing as the current release-candidate addition.

### Claim Boundary

- This release validates the public shape and safety boundaries of Dynamic
  Episode tracing.
- It does not claim proof that real AI-assisted work drift is reduced without
  pilot replay/regression evidence.

## [1.0.0-rc.3] - 2026-06-16

### Added

- Developer-first adoption guide explaining what Mirai Graph solves for
  ordinary software projects, what files it creates and how it helps
  AI-assisted development.
- README sections for concrete developer problems, project use cases, current
  npm publication status, created files and expected bootstrap output.

### Changed

- Working package version is now `1.0.0-rc.3`.
- README now starts from developer value before the broader standard model.
- Getting-started and 15-minute tutorial now point to the developer entry guide
  and state the current pre-npm publication boundary.

### Claim Boundary

- This release candidate improves external developer onboarding.
- It does not claim final stable `1.0.0`, npm publication, peer-reviewed proof,
  production autonomous execution safety or automatic canonical updates.

## [1.0.0-rc.2] - 2026-06-15

### Added

- Self-service onboarding CLI path for `init`, `detect` and `bootstrap`.
- Self-service onboarding fixtures for missing, existing and stale graph states.
- GitHub Action starter for validating Mirai Graph packages.
- "Connect A Project In 15 Minutes" adoption tutorial.
- Developer-first adoption guide explaining concrete project problems, created
  files, expected outputs and AI-assisted development use cases.
- Public documentation map in `docs/README.md`.
- Proposal-level Societal Governance profile and fail-closed fixtures.

### Changed

- Working package version is now `1.0.0-rc.2`.
- README now focuses on developer-first problem framing, created-file
  expectations, npm/repository quickstart and role paths.
- Adoption and developer docs now separate npm usage from contributor checkout.
- Release notes and roadmap now reflect self-service onboarding as part of the
  release-candidate surface.
- Societal Governance is explicitly marked proposal/experimental, not core
  `1.0.0` conformance.

### Claim Boundary

- This release candidate supports self-service external review of Mirai Graph.
- It does not claim final stable `1.0.0`, npm publication, peer-reviewed proof,
  production autonomous execution safety, or automatic canonical updates.

## [1.0.0-rc.1] - 2026-06-12

### Added

- Mirai Graph 1.0 release-candidate notes.
- 1.0 RC public navigation in README, release index and adopter kit.
- Release-candidate framing across core standard, profiles, executable process
  control, instrumentation, Character Layer and evidence boundaries.

### Changed

- Working package version is now `1.0.0-rc.1`.
- README now presents the repository as a public 1.0 release candidate instead
  of the alpha.11 working state.
- Roadmap now separates the 1.0 RC foundation from post-1.0 work.

### Claim Boundary

- This release candidate supports external review of a coherent,
  validator-backed public standard.
- It does not claim final stable `1.0.0`, npm publication, peer-reviewed proof,
  production autonomous execution safety or automatic canonical updates.

## [0.1.0-alpha.11] - 2026-06-11

### Added

- Development Cockpit standard, schema, validator mode and synthetic fixture.
- Feature Implementation Traceability standard, schema, validator mode and
  synthetic fixture.
- Multi-Source Quality Feedback standard, schema, validator mode and synthetic
  fixture.
- Instrumentation readable report through
  `mirai-graph report instrumentation`.
- Instrumentation negative fixtures and `test:instrumentation-layer-negative`.
- Alpha.11 playground instrumentation chain.
- AI Work Field instrumentation bridge for public-safe research framing.

### Changed

- Working package version is now `0.1.0-alpha.11`.
- `npm test` now includes instrumentation validation, readable report checks
  and negative fixtures.
- README, roadmap and evidence docs now describe instrumentation as a bounded
  input to transition decisions.

### Claim Boundary

- This release candidate supports observable process instrumentation in
  public-safe fixtures.
- It does not claim production execution, runtime autonomy, peer-reviewed proof
  or canonical update authorization from cockpit metrics, evidence, feedback or
  proposals.

## [0.1.0-alpha.10] - 2026-06-04

### Added

- Alpha.10 adopter workflow release skeleton.
- Alpha.10 profile-selection guide and adopter workflow CLI commands.
- `validate:adopter-workflow` regression check.
- Release-state CLI report and `validate:release-state` check for package,
  git tag, GitHub Release, npm registry and npm auth boundaries.

### Changed

- Working package version is now `0.1.0-alpha.10`.
- Release-state validation now supports pre-tag checks and strict
  post-release checks through `--require-github-release`.

### Claim Boundary

- This release supports self-service alpha adoption and release-state
  visibility.
- It does not claim npm package publication while npm auth remains unavailable.

## [0.1.0-alpha.9] - 2026-06-04

### Added

- Alpha.9 Mirai Graph rename transition from the former GrowGraph working name.
- Primary `mirai-graph` CLI entrypoint and package manifest name.
- Legacy `mirai_graph` CLI and `mirai-graph-package.json` compatibility wrappers.
- Transition guide for adopters migrating from Mirai Graph naming.
- Alpha.8 starter templates for software project, research program,
  AI employee and organization governance adoption.
- Unified `mirai-graph` CLI wrapper for common validation, report and
  process-transition explanation commands.
- Independent implementation pilot 005 for organization governance.
- Evidence Package v0.2 as the current public research evidence entrypoint.
- Technology Quality Feedback standard, schema, synthetic example, validator
  and negative fixtures for checking whether work followed the declared
  technology before acceptance or release.

### Changed

- Working package version is now `0.1.0-alpha.9`.
- Public-facing standard, package and CLI naming now use Mirai Graph and
  `mirai-graph`; GrowGraph is retained as a historical/legacy alias.
- Alpha.9 release notes now reflect the real GitHub repository, tag and
  prerelease state while keeping npm publication marked pending.
- `npm test` includes starter template validation and unified CLI smoke checks.
- Process-control docs and examples now model technology quality feedback as a
  companion gate for significant acceptance and release transitions.

## [0.1.0-alpha.7] - 2026-06-03

### Added

- Process-transition explanations in JSON validator output.
- Human-readable process-transition decision report output.
- Passing and failing process-transition explanation fixtures.
- `validate:process-transition-report` check for explanation-critical fields.
- Public baseline-comparison result schema, synthetic result artifact and
  `validate:baseline-comparison` check.
- Richer deterministic playground report with transition explanation and
  baseline comparison sections.
- `playground:report` and `validate:playground-report` commands.
- Public-safe research-program pilot package as independent implementation
  pilot 004.
- Alpha.7 release notes and updated roadmap/evidence navigation.

### Changed

- `npm test` now includes process-transition explanation report checks,
  deterministic playground report validation and baseline-comparison
  validation.
- Research evidence docs now distinguish synthetic comparison artifacts,
  public pilot evidence and scientific proof boundaries more explicitly.

### Claim Boundary

- This release supports public alpha readiness claims for executable process
  explanations, deterministic local demos and bounded synthetic comparison
  evidence.
- It does not claim peer-reviewed proof, runtime autonomy, production safety or
  automatic canonical updates from evidence, feedback, runtime results or
  proposals.

## [0.1.0-alpha.6] - 2026-05-31

### Added

- Route Explanation standard draft for auditable owner/companion skill routing.
- Routing Fixtures standard draft for negative route tests and forbidden route
  shapes.
- Federation Health standard draft for conflict details, fixture failures and
  next-action dashboards.
- Route Regression standard draft for comparing route behavior before and
  after learning or router changes.
- Public schemas for route explanations, routing fixtures, fixture runs,
  federation health dashboards and route regression results.
- Synthetic federation routing smoke example with per-fixture evidence,
  high-risk route explanation, regression and health dashboard artifacts.
- `validate:routing-control` release check for the synthetic routing-control
  example.
- Public-safe transfer note for federation routing control-loop patterns.

### Claim Boundary

- This release supports public standard/schema shape claims only.
- It does not claim private federation behavior, graph-only runtime safety,
  owner-source rewrite permission or scientific proof of effectiveness.

## [0.1.0-alpha.5] - 2026-05-31

### Added

- Hybrid Source Of Truth standard draft for graph/raw-source authority
  boundaries.
- Mirai Graph Adoption Levels standard draft with `GGA0..GGA10` staged adoption
  semantics.
- Runtime Enablement standard draft for task-scoped graph-mode preflight,
  fallback and runtime boundary decisions.
- Projection Views standard draft for readiness, risk, owner routing, evidence,
  gates, adoption and runtime control surfaces.
- Alpha `skill_runtime` profile for governed skills, capability modules and
  services.
- Minimal synthetic skill-runtime fixture with profile conformance result.
- Public-safe transfer note recording which graph-managed skill patterns were
  generalized into the public standard.

### Changed

- `npm test` now validates the `skill_runtime` profile and minimal fixture.
- Profile conformance fixture documentation now includes `skill_runtime`.
- README start links now include the new governance and runtime standard
  sections.

### Claim Boundary

- This release supports public standard and profile shape claims only.
- It does not claim graph-only runtime readiness, semantic completeness,
  operational effectiveness, runtime safety or universal validity.

## [0.1.0-alpha.4] - 2026-05-29

### Added

- Context-pack selection explanations with object relevance scores and relation
  inclusion reasons.
- Context-pack validation mode for checking generated pack metadata,
  graph references and selection explanation coverage.
- Negative fixture for missing context-pack selection explanations.
- Positive profile conformance result artifacts for core, project-management
  and software-specification fixtures.
- Public capability map from practical `$graph` areas to Mirai Graph standard,
  schema, tooling, profile and research artifacts.
- Alpha `ai_employee` profile for modeling AI employees, roles, skills,
  knowledge, memory, tools, policies, workflows, actions, feedback, lessons
  and federation endpoints.
- Graph-as-AI-brain, action/runtime boundary and feedback learning gate
  standard drafts.
- Minimal synthetic AI employee fixture and adoption guide.

### Changed

- Context-pack schema and standard now describe selection explanation metadata.
- `npm test` now validates public benchmark and pilot context-pack artifacts.
- `npm test` now checks stored positive profile conformance result artifacts.
- Transfer documentation now distinguishes the historical gap report from the
  current public capability map.
- `npm test` now validates the AI employee profile and minimal fixture.

## [0.1.0-alpha.3] - 2026-05-28

### Added

- Independent implementation pilot 002 for a synthetic software specification
  workflow.
- Pilot validation script now covers both public independent pilots.
- Initial software-specification profile documentation.
- Validator now rejects relation ids that disagree with their source, type and
  target fields.
- Validator now enforces allowed object kinds and relation types for local
  package profiles.
- Initial semantic-completeness review artifacts for the synthetic benchmark
  and software-specification pilot context packs.
- Safety-context inclusion policy for context-pack generation.
- Profile conformance fixture guide.
- Public release process and GitHub Release notes policy.

### Research Notes

- Pilot 002 shows that direct task-to-requirement traceability improves the
  usefulness of generated task context.
- Pilot 002 exposed relation-id consistency as a necessary conformance check.
- Profile conformance fixtures now cover invalid object kinds and relation
  types.
- Semantic review of pilot 002 led to the first safety-context inclusion rule
  for context-pack generation.

### Validation

- `npm run release:check` validates examples, benchmark package, seed, profiles,
  public pilots, context-pack generation, readiness scoring, synthetic
  benchmark calculation and negative fixtures.
- Semantic-completeness review artifacts record `pass_with_notes` verdicts for
  the synthetic benchmark and software-specification pilot context packs.

### Limitations

- Evidence remains synthetic and public-safe.
- Context-pack selection still lacks per-object explanations and relevance
  scores.
- Semantic reviews are maintained artifacts, not automated reviewer consensus.

## [0.1.0-alpha.2] - 2026-05-28

### Added

- Context-pack generator now uses token matching and one-hop relation
  expansion instead of always including the full graph.
- Initial project-management profile documentation.

### Validation

- `npm run release:check` validates the updated context-pack generator and
  existing alpha fixtures.

### Limitations

- Context-pack relevance is still heuristic.
- The generator does not yet explain why each selected object is necessary.
- Semantic completeness still requires reviewer protocol execution.

## [0.1.0-alpha.1] - 2026-05-28

### Added

- Practice-and-science program note.
- Initial `$graph` skill to Mirai Graph transfer map.
- Initial standard gap report comparing practical `$graph` methodology with
  public Mirai Graph.
- Public graph DNA, graph seed and graph embryo standard sections.
- Graph seed and graph embryo schemas.
- Minimal graph seed example.
- Seed preview command that emits a deterministic graph embryo.
- Alpha readiness score command.
- Benchmark script `--write` output mode.
- Measure-convert-optimize public benchmark protocol.
- Initial profile manifests.
- Context-pack and profile schemas.
- Negative validation fixtures.
- Context-pack generator alpha command.
- Profile validation command.
- Independent implementation pilot plan.
- Semantic completeness review protocol.
- Release check script.
- Independent implementation pilot 001 for a synthetic conference planning
  workflow.
- Worked tutorial from graph seed to validated package.
- GitHub Actions CI running `npm run release:check`.

### Validation

- `npm run release:check` validates examples, benchmark, seed, profiles,
  generated context, readiness score, synthetic benchmark and negative fixture.
- Independent pilot 001 validates as a public-safe Level 1 package.

### Limitations

- Context-pack generation is alpha and still includes the full package graph.
- Readiness scoring is an alpha navigation signal, not approval.
- The first independent pilot is synthetic and does not prove real-world
  productivity or external validity.

## [0.1.0-alpha.0] - 2026-05-28

### Added

- Public repository foundation.
- README, roadmap, purpose brief, concept and terminology.
- Dual license strategy: MIT for code and CC BY 4.0 for documentation and
  standard materials.
- Citation metadata.
- Initial standard draft:
  - object model;
  - relation model;
  - lifecycle/readiness;
  - evidence/provenance;
  - governance;
  - conformance levels;
  - context-pack generation;
  - profiles;
  - test-suite direction.
- JSON schemas for:
  - objects;
  - relations;
  - package manifests;
  - governance gate results.
- Initial CLI validator.
- Minimal graph example.
- Synthetic context-reduction benchmark.
- Initial adoption guide.
- Contribution guide.

### Validation

- `npm test` validates the minimal graph package.
- `npm test` validates the synthetic benchmark graph package.
- `npm test` reproduces the synthetic context-reduction calculation:
  `56.4516%`.

### Limitations

- The standard is an early draft.
- The benchmark is synthetic and supports method inspection only.
- There is not yet an independent implementation pilot.
- Context-pack generation is documented but not yet automated.
