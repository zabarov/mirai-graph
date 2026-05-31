# Skill Graph Standard Harvest

Date: 2026-05-31
Status: public-safe transfer note

## Purpose

This note records which reusable patterns from graph-managed skill work were
converted into public GrowGraph standard artifacts.

It does not publish private skill internals, customer material, internal
runtime paths, private metrics or implementation playbooks.

## Transferred Patterns

### Hybrid Source Of Truth

Graph-managed skills need a boundary between generated graph context and raw
owner sources. The public standard now records this as
[Hybrid Source Of Truth](../../standard/hybrid-source-of-truth.md).

Reusable idea:

```text
graph = routing, context, control, readiness and evidence layer
raw source = authoritative methodology, judgement and sensitive rules
```

### Adoption Levels

Practical graph adoption is staged. Valid JSON, a seed or a context pack is not
enough to claim migration. The public standard now records staged GrowGraph
Adoption Levels in [Adoption Levels](../../standard/adoption-levels.md).

Reusable idea:

```text
inventory -> seed -> embryo -> scored -> gated -> semantic review
-> effectiveness -> federation -> graph-first source candidate
```

### Runtime Enablement

Graph context can support runtime tasks only when the task is measured, bounded
and covered by policy. Sensitive work still requires raw-source fallback. The
public standard now records this in
[Runtime Enablement](../../standard/runtime-enablement.md).

Reusable idea:

```text
generated context != authorization
runtime decision != executed action
feedback != canonical update
```

### Projection Views

Dense graphs need user-facing generated views for readiness, risk, owner
routing, gates, evidence, adoption and runtime policy. The public standard now
records this in [Projection Views](../../standard/projection-views.md).

### Skill Runtime Profile

The profile-level pattern is now captured in
[Skill Runtime](../../profiles/skill-runtime/README.md) with an executable
synthetic fixture at:

```text
examples/skill-runtime-minimal/
```

The profile is for governed skills, capability modules and services. It is
not specific to one organization, one AI framework or one internal skill set.

## Public Artifacts Added

- `standard/hybrid-source-of-truth.md`;
- `standard/adoption-levels.md`;
- `standard/runtime-enablement.md`;
- `standard/projection-views.md`;
- `profiles/skill-runtime/profile.json`;
- `profiles/skill-runtime/README.md`;
- `examples/skill-runtime-minimal/`.

## Claims Preserved

The new artifacts support only limited claims:

- profile shape conformance;
- public-safe representation of runtime boundaries;
- staged adoption terminology;
- Hybrid Source Of Truth boundary;
- synthetic example validity.

They do not prove:

- semantic completeness;
- operational effectiveness;
- runtime safety;
- graph-only source-of-truth readiness;
- universal validity.

## Verification

The added profile and fixture are covered by:

```bash
npm run validate:profiles
npm run validate:skill-runtime
npm run validate:profile-results
npm run release:check
```
