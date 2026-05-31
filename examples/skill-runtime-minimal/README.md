# Minimal Skill Runtime Example

Status: synthetic public fixture

This example shows how the `skill_runtime` profile can model a governed skill
or capability module without treating generated graph context as authorization.

The fixture contains:

- one synthetic skill;
- one owner domain;
- one capability and activity;
- raw source and source-boundary objects;
- semantic and effectiveness evidence objects;
- runtime policy, fallback and projection view objects;
- one federation contract placeholder.

It intentionally does not include private source files, customer data,
credentials, production logs or internal playbooks.

## Boundary

```text
raw source -> graph objects -> projection view -> runtime context
runtime policy -> fallback decision -> handoff or federation contract
```

The profile validates the graph shape. It does not prove that the synthetic
skill is useful, safe or ready for production runtime.
