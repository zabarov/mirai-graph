# Changelog

All notable changes to GrowGraph will be documented in this file.

## [Unreleased]

### Added

- Alpha.8 starter templates for software project, research program,
  AI employee and organization governance adoption.
- Unified `growgraph` CLI wrapper for common validation, report and
  process-transition explanation commands.
- Independent implementation pilot 005 for organization governance.
- Evidence Package v0.2 as the current public research evidence entrypoint.

### Changed

- Working package version is now `0.1.0-alpha.8`.
- `npm test` includes starter template validation and unified CLI smoke checks.

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
- GrowGraph Adoption Levels standard draft with `GGA0..GGA10` staged adoption
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
- Public capability map from practical `$graph` areas to GrowGraph standard,
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
- Initial `$graph` skill to GrowGraph transfer map.
- Initial standard gap report comparing practical `$graph` methodology with
  public GrowGraph.
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
