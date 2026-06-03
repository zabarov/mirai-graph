# Mirai Graph Test Suite

Status: initial public draft

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
