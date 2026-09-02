# Mirai Autonomic Fabric Minimal Example

This public-safe fixture demonstrates one bounded cycle:

```text
read-only source snapshot
-> normalized units
-> knowledge proposal
-> intended and observed process candidates
-> autonomy-envelope evaluation
-> adaptive metadata proposal
```

The fixture never writes to an external source, never promotes an effectful
program and never treats observed behavior as normative technology. Generated
results are rebuilt by `npm run generate:mirai-2.2-fixtures`.
