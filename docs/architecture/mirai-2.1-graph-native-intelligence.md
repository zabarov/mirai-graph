# Mirai 2.1 Graph-Native Intelligence

Status: development architecture; not a stable release claim.

Mirai 2.1 extends the Mirai 2.0 Program and Runtime contracts. It does not replace them. Its purpose is to turn distributed sources and graph context into an immutable, explainable execution plan.

```text
sources
-> assimilation proposal
-> multidimensional graph snapshot
-> technology draft
-> Mirai Program
-> activation plan
-> Mirai 2.0 Runtime
-> episode and evidence
-> Kaizen proposal
```

## Planes

1. **Hybrid source plane.** Files and owner systems retain detailed authoritative content. Mirai records navigation, provenance, quality and governing meaning.
2. **Graph plane.** Components, operation contracts and relation facts describe what exists, how it is related and under which context a relationship applies.
3. **Program plane.** Human technology is extracted into a proposal-only draft. Only explicit and statically valid semantics compile to the existing immutable Mirai Program IR.
4. **Activation plane.** An event and goal are resolved against a fixed graph snapshot. The resolver selects operation bindings, inhibitors, dependencies, budgets, approvals and join policies.
5. **Runtime plane.** Mirai 2.0 executes the immutable plan through capability-gated adapters. Evidence never authorizes a canonical update.

## Why this is graph-native

The graph is not a database-shaped copy of source documents and not an inheritance hierarchy. It coordinates many-to-many context: one operation can depend on a role, department, policy, risk, time interval and evidence requirement at once. Relations are therefore first-class facts with participants, roles, qualifiers, scope, time, authority and provenance.

Components use composition, interfaces and contextual dispatch. A component can expose an operation through different program implementations in different scopes. Equal-priority applicable bindings are an error, not a model choice.

## Immutability boundary

The resolver never sends a live mutable graph into the runtime. It produces an activation plan bound to graph, policy and program digests. Canonical changes made after planning cannot alter an active run. Learning produces a reviewable proposal for a later snapshot.

## Current implementation boundary

The development implementation provides Files/Git scanning, assimilation proposals, component/relation validation, technology draft compilation, activation planning and deterministic no-effect simulation. Durable effectful activation remains a beta integration task that must reuse the existing Mirai 2.0 Runtime.
