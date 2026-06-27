# Goal Vector Quality Control Minimal Example

This synthetic example shows how Mirai Graph can check whether a work batch
actually advances a declared final outcome.

The example combines:

- forward execution from start state to final outcome;
- batch vector links;
- required quality evidence;
- reverse audit from desired result back to evidence;
- drift finding classification and correction routing.

It does not authorize release, update canonical graph state or prove production
readiness.

Validate:

```bash
npm run validate:goal-vector-quality-control
npm run test:goal-vector-quality-control-negative
```
