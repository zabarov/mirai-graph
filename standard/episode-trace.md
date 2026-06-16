# Episode Trace

Status: proposal/experimental standard section

## Purpose

An episode trace is the primary artifact of the Dynamic Episode Layer. It is a
structured explanation of why a graph-governed system reacted to an event in a
specific way.

It answers:

```text
what arrived
what activated
which workflow was selected
which path was followed
which alternatives were blocked
which gates passed or failed
which assumptions were made
what result happened
what findings were classified
what feedback or Kaizen route should follow
```

## Not A Thought Log

An episode trace does not expose or claim to know the hidden internal reasoning
of an LLM. It records the operational reason visible to the graph-controlled
system: selected workflow, activated graph elements, gates, policies, evidence,
results and findings.

## Minimum Trace Shape

```text
event
source_refs
activated
selected_path
blocked_paths
gates
actions
results
findings
feedback_classification
kaizen_candidates
replay_regression
evidence_refs
limitations
canonical_write_allowed=false
```

## Failure Analysis Loop

```text
episode trace
-> finding classification
-> root-cause candidate
-> feedback route
-> work fix / test gap / spec gap / graph proposal / process improvement
-> Kaizen proposal
-> replay or regression check
```

Common root-cause candidates include:

- `wrong_workflow_selected`;
- `missing_dependency_activation`;
- `scope_gate_not_activated`;
- `scope_gate_ignored`;
- `approval_gate_bypass`;
- `unsupported_assumption`;
- `technology_step_skipped`;
- `evidence_treated_as_authorization`;
- `character_boundary_not_activated`;
- `context_pack_missing_required_object`.

## Replay And Regression

Replay uses the same or equivalent event against a graph/process version and
compares:

- selected path;
- blocked paths;
- required gates;
- findings;
- result;
- explanation grounding.

Replay is required before claiming that a graph or technology-chain change
improved behavior.

## Public Safety

Public traces must be sanitized. Do not publish private event payloads,
credentials, customer data, raw private logs or internal evidence unless they
have been explicitly approved for publication.
