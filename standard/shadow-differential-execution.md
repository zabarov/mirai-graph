# Shadow Differential Execution

Status: Mirai 2.1 draft contract

Shadow Differential Execution compares an accepted owner source or legacy
process baseline with an immutable Mirai Activation Plan before any effect is
authorized. It is a zero-write proof surface, not a production rehearsal and
not an approval token.

```text
accepted source or legacy plan
-> accepted baseline contract
-> immutable activation plan
-> deterministic simulation
-> mandatory-step closure
-> scope and effect delta
-> rollback coverage
-> passed or blocked shadow result
```

The accepted baseline lists mandatory operations, allowed component, operation,
capability and effect scope, and rollback requirements. Acceptance must have an
evidence reference. Portable baseline data cannot grant a capability or permit
a canonical write.

A passing result requires all of the following:

- simulation executed no effects;
- every mandatory step has a matching activation path;
- no component, operation or capability exceeds accepted scope;
- referenced Programs declare no unknown effect;
- every effectful or explicitly reversible step has rollback coverage;
- Program, plan and baseline digests are valid.

The result always has `activation_allowed=false` and
`canonical_write_allowed=false`. A host may use the result as evidence when
making a later policy decision, but the result cannot authorize execution.

Missing mandatory work, scope expansion, unknown effects, missing rollback or
digest mismatch fail closed. The comparison does not prove domain correctness,
outcome quality or production safety; those require domain review, runtime
evidence and deployment-specific gates.
