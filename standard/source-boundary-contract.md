# Source Boundary Contract

Status: initial public standard note

## Purpose

Source boundary contracts define which repository or graph areas are canonical,
generated, curated for human review, evidence, workflow records, legacy context,
tooling or local scratch.

They prevent generated artifacts, review notes or implementation repositories
from silently becoming source of truth.

## Source Roles

- `canonical`: reviewed source-of-truth data or rules.
- `generated`: reproducible output from canonical or evidence sources.
- `curated_human`: reviewed human-readable projection or explanation.
- `workflow`: process, planning, launch, recovery or coordination record.
- `evidence`: reviewed support material for a claim.
- `legacy`: historical material preserved for traceability.
- `tooling`: validators, generators, schemas or support scripts.
- `local_scratch`: ignored local intake or temporary workspace.

## Synchronization Flow

```text
canonical sources
-> tooling
-> generated and curated views
-> human review or implementation planning
-> accepted proposals
-> canonical update
-> regenerated views
```

## Promotion Rule

If generated output, human review, workflow records or evidence contain a new
important fact, that fact must be promoted through an explicit proposal before
it becomes canonical state.

## Schema

Machine-readable source boundary contracts can be validated with:

```text
schemas/source-boundary-contract.schema.json
```
