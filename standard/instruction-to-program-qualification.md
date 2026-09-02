# Instruction-to-Program Qualification

Status: additive Mirai 2 development contract

## Purpose

Mirai must not treat every natural-language instruction as executable code.
Before compilation, each action is explicitly classified as:

- `executable`: deterministic Program or adapter operation with declared effects;
- `verifiable`: a required check with an explicit verification reference;
- `advisory`: expert judgement that remains visible and owner-bound;
- `decision`: an authority-bearing choice that remains visible and owner-bound;
- `unsupported`: an operation that cannot safely enter the current plan.

The qualification result is digest-bound to the source Technology Draft. It is
portable evidence about meaning and readiness. It is not a capability grant,
approval receipt or canonical update authorization.

## Lifecycle

```text
owner instruction
-> Technology Draft
-> explicit operation bindings
-> Qualification Result
-> Hybrid Technology Plan
-> simulation or later governed activation
```

Possible qualification states:

- `instruction_only`: the technology contains no executable operation;
- `program_candidate`: classifications exist but acceptance is incomplete;
- `hybrid_ready`: executable operations and human checkpoints are both explicit;
- `executable_ready`: all action steps can compile into Mirai Program semantics;
- `blocked`: ambiguity, unsupported behavior or an unsafe binding remains.

`executable_ready` means compile-ready, not authorized to run. Qualification
and hybrid-plan artifacts always keep `activation_allowed=false`. A later host
policy and capability decision is required for activation. A `hybrid_ready`
plan also requires a separate human coordination mechanism and cannot silently
flatten advisory or decision checkpoints into effects.

## Fail-Closed Rules

- Missing or duplicate action bindings block qualification.
- An executable adapter action declares effects and capability requirements.
- A verifiable action requires a verification reference and tester acceptance.
- Advisory and decision actions require an owner and owner acceptance.
- Every accepted classification carries an evidence reference; the reference
  is not itself an approval and must be verified by the consuming host.
- Advisory and decision actions cannot bind a Program, adapter or effect.
- Unsupported actions always block.
- A stale or modified qualification digest cannot compile.
- Generated qualification, simulation and evidence never authorize canonical
  graph changes or external effects.

## Hybrid SOT Boundary

The owner instruction remains authoritative for detailed judgement. The
Technology Draft and qualification artifacts store typed, governable meaning,
source references and readiness. They do not copy the full owner methodology
into the graph or replace its source of truth.
