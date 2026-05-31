# Skill Runtime Profile

Status: alpha profile

The `skill_runtime` profile models a governed skill, capability module or
service as a GrowGraph-managed runtime context.

It is designed for systems where the graph helps with routing, capability
selection, policy reminders, readiness, evidence and generated context, while
raw source material remains authoritative for detailed domain meaning.

## Object Kinds

The profile includes:

- `skill`;
- `capability`;
- `activity`;
- `rule`;
- `owner_domain`;
- `source_boundary`;
- `raw_source`;
- `runtime_context`;
- `projection_view`;
- `quality_gate`;
- `adoption_report`;
- `effectiveness_report`;
- `semantic_review`;
- `runtime_policy`;
- `fallback`;
- `handoff`;
- `learning_proposal`;
- `federation_contract`;
- `governance_gate`;
- `evidence`.

## Relation Types

The profile includes relation types for:

- owner boundaries;
- capabilities and activities;
- rules and quality gates;
- raw-source fallback;
- generated runtime context;
- semantic preservation;
- effectiveness measurement;
- routing and handoff;
- federation contracts;
- learning proposals.

## Hybrid SOT Boundary

This profile uses [Hybrid Source Of Truth](../../standard/hybrid-source-of-truth.md).

```text
graph context can route and orient work
raw source remains authoritative for domain meaning
```

Generated runtime context must not rewrite skill sources or grant canonical
write permission.

## Runtime Boundary

Runtime use follows [Runtime Enablement](../../standard/runtime-enablement.md).

Graph-mode can become the primary context only for a declared task and scope
after runtime preflight. Sensitive work requires fallback to raw sources and
the relevant approval gates.

## Minimal Fixture

The executable fixture is:

```text
examples/skill-runtime-minimal/
```

It proves only profile shape conformance. It does not prove semantic
completeness, operational effectiveness or runtime safety.
