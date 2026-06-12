# Character Layer Starter

Use this template when a project, AI employee, research workflow or governed
runtime needs a reusable Character Layer package.

The starter provides:

- base character constitution;
- reusable behavior principles;
- character virtues;
- hard character boundaries;
- reflection protocol;
- role character profiles;
- violation patterns;
- owner-reviewed correction loop;
- public-safety and review-boundary gates.

Validate:

```bash
node packages/cli/validate-mirai-graph.js templates/character-layer-starter
```

## Adaptation Path

1. Keep the base constitution unless a project has a stronger reviewed
   constitution.
2. Select the closest `role_character_profile`.
3. Add project-specific boundaries only when they are evidence-backed.
4. Keep tool permission, runtime authorization and external action policy in
   runtime/process layers, not in this profile.
5. Add fixtures for every behavior that must remain stable across model
   backends.

## Boundary

This starter is a behavior-governance template. It does not train a model,
grant runtime permissions, authorize external actions or prove scientific
effectiveness.
