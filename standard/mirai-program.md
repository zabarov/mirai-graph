# Mirai Program

Status: `2.1.0-rc.1` frozen contract with pure and governed reference execution

## Purpose

A Mirai Program is a typed, immutable and bounded description of a technology
that can be validated before execution. It removes control-flow memory from an
AI prompt without turning graph content into authority.

```text
intent or event
-> governed graph context
-> Mirai Program
-> static validation
-> simulation
-> authorization
-> runtime execution
```

Mirai Graph Core remains responsible for meaning, relations, provenance,
policies and evidence. Mirai Program is responsible for explicit inputs,
outputs, state slots, decisions and finite control flow. Mirai Runtime is a
separate component responsible for execution.

## Authoring And IR

Humans author `.mirai.yaml`. The compiler parses YAML with duplicate-key
rejection, normalizes defaults, sorts object keys and emits `.mirai.json`.
Runtime implementations execute JSON IR only.

The Program contract version is `1.0.0`. Required top-level fields are:

```text
contract_version, id, version, imports, inputs, outputs, state,
nodes, entry, error_routes, policies, source_map, digest
```

The semantic digest covers executable content but excludes `source_map`, whose
file names and line numbers are diagnostic metadata. Moving or reformatting an
equivalent source therefore does not change its executable identity.

## Types And Expressions

Programs use explicit primitive and compound types. Conditions are expression
AST objects such as `ref`, `eq`, `and`, `get` and `coalesce`; string `eval`,
runtime code injection and implicit coercion are forbidden.

## Control Flow

The 1.0 Program contract recognizes `call`, `branch`, `match`, `foreach`,
`parallel`, `await`, `retry`, `timeout`, `cancel`, `compensate`, `emit` and
`return`.

- `foreach` requires a finite collection and `max_iterations`;
- retry requires attempts, timeout and backoff;
- await requires a deadline;
- parallel work has a width budget and explicit merge policy;
- mutable state is not shared between parallel branches;
- unbounded `while` and arbitrary `race` are outside 2.0.

## Effects Boundary

A Program declares an effect but cannot authorize it. Non-pure calls require a
capability reference. The runtime must obtain a host-issued capability bound to
the exact run, node, adapter, operation, resource, budget, expiry, policy
digest and approval receipt.

Program content, graph content, generated context, evidence and previous
episodes cannot mint a capability or update canonical graph state.

## Validation Levels

1. JSON Schema validates the portable shape.
2. Semantic validation checks types, references, bounds, declared effects and
   digest.
3. Simulation reports reachable paths and effects without executing them.
4. Pure runtime conformance applies to effect-free programs.
5. Governed execution requires a host-issued capability for every external
   effect and durable receipt verification before completion.

See `schemas/mirai-program.schema.json` and
`examples/mirai-program-minimal/`.
