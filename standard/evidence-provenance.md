# Mirai Graph Evidence And Provenance

Status: 1.0 release-candidate standard section

## Purpose

Evidence and provenance rules explain how Mirai Graph links graph state to the
materials, observations, decisions and reviews that justify it.

Mirai Graph does not require every early idea to be fully proven. It does require
important claims, accepted objects, accepted relations and public validation
statements to make their evidence boundary explicit.

## Evidence Object

Evidence may be represented as a first-class object:

```json
{
  "id": "source.example_note",
  "kind": "evidence",
  "title": "Example source note",
  "summary": "A public-safe note used as evidence for a synthetic example.",
  "readiness": "accepted",
  "evidence": [],
  "profile": "software_specification",
  "source_path": "source-corpus/example.md"
}
```

## Evidence Reference

Objects and relations reference evidence by stable id:

```json
{
  "id": "feature.example",
  "evidence": ["source.example_note"]
}
```

For mature Mirai Graph packages, evidence references should resolve to evidence
objects or declared external sources.

## Evidence Levels

Initial evidence levels:

- `synthetic`: artificial example or benchmark material;
- `internal_case`: internal project or operational evidence;
- `public_source`: public document, paper, repository or standard;
- `experiment`: structured experiment result;
- `review`: expert or peer review record;
- `decision`: accepted governance or owner decision.

Future schemas may add an explicit `evidence_level` field.

## Provenance Questions

For important graph state, a reviewer should be able to answer:

- Where did this object or relation come from?
- Is the source public, private, synthetic or experimental?
- Who accepted it into canonical state?
- What changed since the previous version?
- Can this evidence be used publicly?
- Does the evidence support the claim being made?

## Public-Safe Evidence Rules

Public Mirai Graph repositories should not include:

- private source chats;
- raw internal company materials;
- customer or employee data;
- secrets or access details;
- private repository paths;
- unpublished client work;
- private metrics without approval and redaction.

Use synthetic data or generalized public-safe summaries when public evidence is
needed.

## Claim Discipline

Evidence must match claim strength.

Synthetic benchmark evidence can support:

- method inspection;
- reproducibility of an example calculation;
- schema and tooling demonstration.

Synthetic benchmark evidence cannot support:

- external validity;
- real-world productivity improvement;
- universal superiority claims;
- agent safety claims.

Internal case evidence can support:

- case-study claims;
- design feasibility;
- observed workflow patterns.

Internal case evidence cannot be treated as public reproducibility unless the
data boundary and redaction plan are public and approved.

## Provenance In Generated Context Packs

A generated context pack should preserve evidence references for the objects and
relations it includes.

If context is compressed, the pack should still make clear:

- what canonical objects it uses;
- what evidence supports them;
- what was omitted;
- what the task boundary is.

## Anti-Patterns

- Treating a citation as evidence for a claim it does not support.
- Treating synthetic examples as real-world validation.
- Copying private source material into public examples.
- Losing evidence references during context-pack generation.
- Marking a public claim as validated before review.
