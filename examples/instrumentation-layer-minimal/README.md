# Instrumentation Layer Minimal Example

This example shows the Mirai Graph release-candidate instrumentation pattern:

```text
feature intent
-> implementation traceability
-> development cockpit
-> multi-source quality feedback
-> transition decision
-> Kaizen route
```

The package is synthetic and public-safe. It does not contain private project paths, real customer data, runtime traces, or organization-specific policies.

## Validate

```bash
npm run validate:instrumentation-layer
```

Targeted checks:

```bash
npm run validate:development-cockpit
npm run validate:feature-implementation-traceability
npm run validate:multi-source-quality-feedback
```

## Boundary

Cockpit metrics, traceability, feedback, evidence, and proposals support a governed transition decision. They do not authorize execution, acceptance, release, or canonical graph updates by themselves.
