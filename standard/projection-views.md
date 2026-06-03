# Projection Views

Status: alpha standard section

## Purpose

A full Mirai Graph can become too dense for direct human review. Projection views
are bounded generated views that expose the part of the graph needed for a
specific decision, task or review.

Projection views are control surfaces. They help people and AI systems inspect
readiness, risk, evidence and next actions without treating the generated view
as the source of truth.

## Common View Types

- `readiness_view`: current readiness and blockers;
- `risk_view`: risks, unsafe actions and required gates;
- `owner_routing_view`: owner domains, capabilities and routing paths;
- `evidence_view`: evidence coverage and unsupported claims;
- `gate_view`: governance gates, verdicts and missing approvals;
- `adoption_view`: Mirai Graph adoption level and next action;
- `runtime_view`: runtime policy status, fallback and context refs;
- `learning_view`: feedback, proposals, evaluations and approved updates.

## Required Fields

A projection view should record:

- `id`;
- `view_type`;
- `source_graph`;
- `generated_at`;
- `purpose`;
- `included_objects`;
- `included_relations`;
- `evidence`;
- `limitations`;
- `next_actions`.

## Authority Boundary

A projection view is generated context. It should not become canonical graph
state unless an implementation explicitly records an approved update.

Projection views may reveal gaps. They should not silently fill those gaps.

## User Value

Projection views are important because they make Mirai Graph usable for repeated
management work:

- what is ready;
- what is blocked;
- who owns the next step;
- which evidence supports a claim;
- which gate must happen before action;
- what changed since the previous review.

## Limited Claim

A projection view supports this limited claim:

```text
The implementation generated a bounded, task-specific view from graph state.
```

It does not prove that the graph is complete or that the recommended action is
safe to execute.
