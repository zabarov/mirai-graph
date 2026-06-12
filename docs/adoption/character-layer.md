# Character Layer Adoption

Status: alpha profile guide

## Purpose

The Character Layer profile defines a public Mirai Graph vocabulary for
model-independent AI character governance.

It is intended for systems that need to represent:

- character constitutions;
- principles and character virtues;
- character boundaries;
- role-specific character profiles;
- reflection protocols;
- evaluation fixtures;
- violation patterns;
- correction loops;
- evidence and governance gates.

## Profile Boundary

Character Layer stores canonical character state and review structure in a
graph package. Runtime systems can project that graph into task context, but
generated context remains separate from authorization, external action and
canonical updates.

Recommended boundary:

```text
canonical character graph
-> generated character context
-> runtime reflection
-> proposed answer or action
-> policy or action gate
-> output or execution
-> reviewed result
-> feedback
-> correction proposal
-> owner-approved canonical update
```

## Relationship To AI Employee

Use `character_layer` when the main object is behavior governance: principles,
boundaries, reflection, fixtures, violations and correction loops.

Use `ai_employee` when the main object is an executable AI worker model: roles,
skills, tools, capabilities, workflows, actions, feedback and lessons.

The profiles can be composed by a system design, but the first Character Layer
profile is separate and does not modify `profiles/ai-employee/`.

Typical composition:

```text
ai_employee -> has_role -> role
role_character_profile -> governs_role -> role
role_character_profile -> governs_employee -> ai_employee
role_character_profile -> specializes_character -> character_constitution
role_character_profile -> uses_reflection_protocol -> reflection_protocol
character_boundary -> requires_escalation_to -> governance_gate
correction_loop -> updates_character -> role_character_profile|character_principle|character_boundary
```

## Minimal Package

The minimal package is:

```text
examples/character-layer-minimal/
```

It includes:

- one public-safe character constitution;
- principles for uncertainty, authority boundaries and evidence reporting;
- character virtues for evidence honesty and boundary discipline;
- character boundaries for generated authorization and secret exposure;
- a reflection protocol;
- a role character profile;
- a fixture, violation pattern and correction loop;
- gate results for public safety, canonical writes, external actions, feedback
  learning and scientific claims.

## Starter Pack

For new projects, start from the reusable starter:

```text
templates/character-layer-starter/
```

It expands the minimal fixture into a base character constitution, reusable
principles, character virtues, hard boundaries, reflection protocol, several
role character profiles, violation patterns and an owner-reviewed correction
loop.

Use it when the same behavior governance layer should be reused across AI
employees, project roles or model backends.

## Cross-Layer Integration

Character Layer should compose with other layers through an integration artifact
rather than by mixing all profile vocabularies into one package.

Minimal synthetic integration example:

```text
examples/character-layer-integration-minimal/
```

It links:

- `role_character_profile` to AI employee and role references;
- launch record and process-control contract references;
- technology quality feedback;
- runtime generated context boundary;
- reflection protocol;
- required gates for approval, review and technology feedback.

## Model Portability Evidence

To test whether a new neural model backend preserves behavior, compare model
runs against the same task set, graph context and character profile.

Minimal synthetic evidence shape:

```text
examples/model-portability-minimal/
```

This records fixture results, boundary violations, comparison metrics and a
bounded verdict such as `portable_within_fixture_limits`. It does not prove
broad model equivalence or production replacement readiness.

## 1.0 Readiness Consolidation

The Character Layer 1.0 readiness artifact is:

```text
examples/character-layer-readiness-1-0/
```

It consolidates profile vocabulary, minimal fixture, starter pack, semantic
anti-fixtures, cross-layer integration, model portability evidence shape,
validation commands, claim boundaries and remaining limits.

## Validation

From the repository root:

```bash
node packages/cli/validate-mirai-graph.js profile profiles/character-layer/profile.json
node packages/cli/validate-mirai-graph.js examples/character-layer-minimal
node packages/cli/validate-mirai-graph.js templates/character-layer-starter
node packages/cli/validate-mirai-graph.js character-layer-integration examples/character-layer-integration-minimal/results/character-layer-integration.json
node packages/cli/validate-mirai-graph.js model-portability-evidence examples/model-portability-minimal/results/model-portability-evidence.json
node packages/cli/validate-mirai-graph.js character-layer-readiness examples/character-layer-readiness-1-0/results/character-layer-readiness.json
npm run validate:character-layer
npm run validate:character-layer-starter
npm run validate:character-layer-integration
npm run validate:model-portability-evidence
npm run validate:character-layer-readiness
```

## Evidence Limits

The current profile and example provide structural conformance evidence for the
Mirai Graph package shape. Scientific effectiveness claims require separate
research design, measurements and review.

The current alpha profile does not claim improvements in trust, safety,
auditability, consistency or employee performance.

## Public Safety

Public examples should use synthetic or public-safe content only.

Do not include:

- private operational constitutions;
- customer data;
- credentials, tokens or private keys;
- private runtime logs;
- organization-specific instructions that should stay internal.

## Adoption Checklist

- Choose `character_layer` only when behavior-governance objects are central.
- Keep canonical graph state separate from generated runtime context.
- Keep generated context separate from authorization.
- Add gate results for public safety and canonical-write boundaries.
- Mark scientific or product-effectiveness claims as out of scope until
  supported by research evidence.
