# Mirai Graph Adoption Levels

Status: 1.0 release-candidate standard section

## Purpose

Mirai Graph adoption is not binary. A repository, project, product, AI employee
or skill can contain valid graph artifacts without being ready for runtime use
or source-of-truth migration.

Adoption levels define a staged path from no graph artifacts to a governed
graph-first source candidate.

## Levels

| Level | Name | Meaning |
| --- | --- | --- |
| GGA0 | `not_started` | No Mirai Graph artifacts are present. |
| GGA1 | `inventoried` | Sources, owner boundaries and target scope are identified. |
| GGA2 | `seeded` | A Graph Seed exists and validates. |
| GGA3 | `embryo_reviewable` | Graph Embryo and initial projection views exist. |
| GGA4 | `scored` | Readiness, quality or control dashboard evidence exists. |
| GGA5 | `proposal_gated` | Candidate graph changes pass through proposal, review and apply gates. |
| GGA6 | `semantically_preserved` | Meaning-preservation review passed for the declared scope. |
| GGA7 | `effectiveness_checked` | Representative tasks show non-regressed or improved operation. |
| GGA8 | `federation_ready` | Bounded federation export or contract is valid. |
| GGA9 | `federation_integrated` | The graph participates in a larger graph, skill mesh or service federation. |
| GGA10 | `graph_first_source_candidate` | A separate decision allows graph-first source planning or dry-run work. |

## Sequential Gate Rule

Later levels should not skip earlier gates. A system should not claim `GGA8`
if semantic preservation and effectiveness evidence are missing.

`GGA10` does not grant canonical write permission. It only means graph-first
source planning or dry-run work may start under a separate decision artifact.

## Required Evidence

An adoption report should record:

- target scope;
- source classes;
- owner boundary;
- profile;
- latest level;
- level evidence;
- blockers;
- next action;
- gate results;
- limitations.

## Anti-Claims

Do not claim that a graph is migrated because:

- JSON validates;
- a seed exists;
- a context pack was generated;
- a dashboard is green;
- a profile conformance fixture passed.

Those are useful signals, not full adoption.

## Limited Claim

Passing a level supports only the claim attached to that level. For example,
`GGA2` supports the claim that a Graph Seed validates. It does not support a
claim that the graph preserved domain meaning or improved work.
