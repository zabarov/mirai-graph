# Mirai Graph Governance

Status: initial public draft

## Purpose

Governance rules define how Mirai Graph controls updates, generated context,
public claims and action-capable workflows.

The central distinction is:

```text
suggestion != decision
generated context != canonical state
evidence != claim
plan != action
private material != public material
```

## Governance Gate

A governance gate is a rule or checkpoint that decides whether something may
proceed.

Gate examples:

- accept object into canonical graph;
- accept relation into canonical graph;
- publish material;
- execute action;
- generate external-facing context;
- claim validation;
- migrate from one standard version to another.

## Gate Record

A gate record should include:

```json
{
  "id": "gate.public_release.synthetic_benchmark",
  "kind": "governance_gate",
  "title": "Public release check for synthetic benchmark",
  "summary": "Checks that benchmark material is synthetic and public-safe before release.",
  "readiness": "accepted",
  "evidence": [],
  "profile": "core"
}
```

Future schemas may define a separate gate-result structure.

## Update Governance

Canonical graph updates should be gated when they:

- change accepted objects;
- change accepted relations;
- resolve or introduce contradictions;
- affect public claims;
- affect action permissions;
- change conformance status.

Generated suggestions may propose updates, but they do not become canonical
state until accepted through the appropriate gate.

## Action Governance

If a Mirai Graph implementation supports actions, it must separate:

- proposed action;
- authorized action;
- executed action;
- action evidence;
- rollback or recovery path.

Action-capable implementations need stricter gates than documentation-only
implementations.

## Public Release Governance

Before public release, check:

- no private source material;
- no secrets;
- no customer or employee data;
- no private repository paths;
- no unsupported validation claims;
- licensing is clear;
- synthetic materials are marked as synthetic.

## Claim Governance

Claims must be gated by evidence level.

Example:

- `The synthetic benchmark calculation is reproducible` may be claimed after a
  passing benchmark run.
- `Mirai Graph improves real-world productivity` requires real-world validation
  evidence.
- `Mirai Graph is universally valid` should not be claimed without broad
  independent replication.

## Human Oversight

Mirai Graph can support AI-assisted work, but governance-sensitive operations
should have human oversight.

Human oversight is especially important for:

- public claims;
- external publication;
- irreversible actions;
- permission changes;
- legal, financial, safety or privacy-sensitive decisions.

## Failure Handling

A governance gate may produce:

- `pass`;
- `pass_with_notes`;
- `blocked`;
- `rejected`;
- `needs_more_evidence`.

Blocked items should remain traceable. Do not delete a blocked element merely to
make the graph look clean.

## Anti-Patterns

- Letting generated AI output directly mutate canonical state.
- Treating approval for one profile as approval for all profiles.
- Publishing synthetic evidence as real-world proof.
- Hiding governance failures.
- Combining private implementation notes with public standard text.
