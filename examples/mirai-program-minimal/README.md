# Minimal Mirai Program

This fixture shows a typed, bounded and effect-free decision program. Compile
and inspect it without executing external actions:

```bash
mirai program validate examples/mirai-program-minimal/program.mirai.yaml
mirai compile examples/mirai-program-minimal/program.mirai.yaml --out /tmp/review-decision.mirai.json
mirai simulate examples/mirai-program-minimal/program.mirai.yaml --input examples/mirai-program-minimal/input-approved.json
```

Compilation produces deterministic JSON IR and a digest. Static simulation
shows reachable paths and declared effects; it does not authorize or perform
an action.
