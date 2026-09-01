# Mirai 2 Federation Beta Pilot

Status: engineering evidence complete; comparative review pending

This public-safe pilot encodes a Federation technology handoff as a nested
Mirai Program. It checks route evidence, Technology Execution Packet evidence,
skill-sync evidence and reverse-audit evidence before recording the Kaizen
terminal decision.

The pilot deliberately does not change the installed Federation. Historical
Mirai Graph 1.4 evidence is cited separately and is not relabeled as a Mirai 2
run.

```bash
mirai simulate \
  pilots/mirai-2-beta-federation/programs/results/program.mirai.json \
  --input pilots/mirai-2-beta-federation/input.json \
  --import stage_check=pilots/mirai-2-beta-federation/programs/results/stage-check.mirai.json
```

The committed episode and replay result show deterministic subprogram calls,
an explicit reverse audit and zero external effects.
