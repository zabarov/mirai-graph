# Changelog

All notable changes to GrowGraph will be documented in this file.

## [Unreleased]

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
