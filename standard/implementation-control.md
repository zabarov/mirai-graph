# Implementation Control

Status: initial public standard note

## Purpose

Implementation control defines how GrowGraph represents governed movement from
project knowledge to implementation action without confusing generated context,
feedback, proposals, approvals and canonical state.

## Control Loop

```text
implementation baseline
-> generated projection view
-> semantic review
-> workflow batch
-> evidence pack
-> sync proposal
-> approval gate
-> controlled update
-> updated baseline
-> improvement item
```

## Rules

- Generated context is not authorization.
- Human feedback is not an automatic canonical update.
- Implementation evidence is not proof of approval.
- A sync proposal must remain separate from an approved update.
- Canonical updates require explicit governance gates.
- Public transfer requires public-safety review and synthetic examples unless
  the source material is already public.

## Profile

Machine-readable profile:

```text
profiles/implementation-control/profile.json
```

## Schema

The initial loop schema is documented at:

```text
schemas/implementation-control-loop.schema.json
```

It validates the shape of a loop result, not the semantic truth of the
implementation.
