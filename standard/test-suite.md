# Mirai Graph Test Suite

Status: 1.0 release-candidate standard section

## Purpose

The Mirai Graph test suite verifies that examples, packages and implementations
follow the standard.

The test suite should cover structure, conformance, context-pack generation,
governance gates and benchmark reproducibility.

## Current Smoke Tests

Run:

```bash
npm test
```

Current checks:

- validate minimal graph package;
- validate synthetic benchmark graph package;
- validate public profile manifests;
- validate public pilot packages;
- validate dynamic episode traces and reject unsafe trace semantics;
- validate goal-vector quality-control reports and reject false-progress
  semantics;
- run deterministic seed preview;
- generate benchmark context pack;
- score benchmark readiness;
- run synthetic context-reduction calculation;
- reject negative fixtures.

## Structural Validation

Structural validation checks:

- required object fields;
- required relation fields;
- unique object ids;
- unique relation ids;
- relation source/target references;
- readiness values;
- evidence arrays;
- optional package manifest;
- optional gate result records.

## Profile Conformance

Profile conformance checks:

- package object kinds are allowed by `manifest.profile`;
- package relation types are allowed by `manifest.profile`;
- relation ids agree with source, type and target fields.

Fixture guide:

```text
docs/adoption/profile-conformance-fixtures.md
```

Current validator:

```bash
node packages/cli/validate-mirai-graph.js <package-dir>
```

## Dynamic Episode Validation

Dynamic episode validation checks:

- event presence;
- source refs;
- activated objects, relations, policies, gates and technology steps;
- selected path;
- blocked paths;
- finding classifications;
- feedback classifications;
- Kaizen route for process improvements;
- replay/regression placeholders;
- `canonical_write_allowed=false`;
- absence of evidence-as-authorization language.

Current commands:

```bash
npm run validate:dynamic-episodes
npm run validate:dynamic-episode-report
npm run test:dynamic-episodes-negative
```

## Goal Vector Quality Control Validation

Goal-vector validation checks:

- final outcome and start state presence;
- visible vector segments and batch vector links;
- evidence before completion claims;
- reverse audit before pass verdicts;
- rejection of tests-as-acceptance language;
- correction routes for drift findings;
- `canonical_write_allowed=false`;
- public-safety boundaries.

Current commands:

```bash
npm run validate:goal-vector-quality-control
npm run test:goal-vector-quality-control-negative
```

## Benchmark Reproducibility

Synthetic benchmark:

```bash
node benchmarks/synthetic-context-reduction-v0/scripts/calculate-context-reduction.js
```

Expected result:

```text
56.4516%
```

This test verifies arithmetic reproducibility only. It does not validate
semantic completeness or real-world performance.

## Future Tests

Planned:

- context-pack metadata validation;
- context-pack evidence preservation;
- governance gate result validation;
- package manifest validation;
- semantic completeness review fixture validation;
- cross-package import/export tests.

## Test Result Policy

Every test result should state:

- command;
- expected output;
- actual output;
- verdict;
- limitations.

Do not convert a passing smoke test into a stronger scientific claim.
