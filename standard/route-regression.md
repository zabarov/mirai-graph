# Route Regression

Status: 1.0 release-candidate standard section

## Purpose

Route regression compares router behavior before and after a learning proposal,
router update or federation graph change.

## Result Shape

A route regression result should include:

- before route result reference;
- after route result reference;
- diff summary;
- per-fixture route diffs;
- regression status.

Recommended statuses:

```text
improved
unchanged
regressed
blocked
insufficient_evidence
```

## Boundary

Route regression is evidence for review. It does not prove semantic completeness
or authorize graph-only runtime.
