# From Graph Seed To Validated Package

Status: worked tutorial

## Goal

This tutorial shows the basic Mirai Graph adoption path:

```text
graph seed -> graph embryo preview -> graph package -> validation -> context pack -> readiness score
```

It uses the synthetic conference planning pilot.

## 1. Validate The Seed

```bash
node packages/cli/validate-mirai-graph.js seed pilots/independent-implementation-001-conference-planning/graph-seed.json
```

Expected:

```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

## 2. Generate A Graph Embryo Preview

```bash
node packages/cli/seed-preview.js pilots/independent-implementation-001-conference-planning/graph-seed.json
```

The embryo is a reviewable candidate state. It is not canonical graph state.

## 3. Create Package Files

Minimum package shape:

```text
mirai-graph-package.json
graph/
  objects.json
  relations.json
gates/
  results.json
```

Use the pilot package as an example:

```text
pilots/independent-implementation-001-conference-planning/
```

## 4. Validate The Package

```bash
node packages/cli/validate-mirai-graph.js pilots/independent-implementation-001-conference-planning
```

Expected:

```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

## 5. Generate A Context Pack

```bash
node packages/cli/context-pack.js pilots/independent-implementation-001-conference-planning --task-id task.prepare_speaker_schedule
```

Current alpha behavior:

The generator uses token matching and one-hop relation expansion. It remains an
alpha generator and does not prove semantic completeness.

## 6. Score Readiness

```bash
node packages/cli/readiness-score.js pilots/independent-implementation-001-conference-planning --target-mode pilot
```

Interpretation:

Readiness score is a navigation signal, not approval. Synthetic-only evidence
and missing benchmark evidence cap the score.

## 7. Record Findings

Write a pilot report:

```text
pilots/<pilot-id>/reports/pilot-report.md
```

At minimum record:

- domain;
- research question;
- validation result;
- readiness score;
- what worked;
- gaps found;
- supported claims;
- unsupported claims.

## Common Mistakes

- Treating embryo output as canonical graph state.
- Skipping public-safety gate results.
- Creating relations to missing objects.
- Using readiness score as approval.
- Claiming practical improvement without a baseline comparison.
