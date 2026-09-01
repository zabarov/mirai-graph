# Mirai Governed Runtime Minimal

Status: public-safe synthetic `2.0.0-alpha.3` example

This fixture reads one file through a host-issued repository capability,
records a verified receipt and produces a governed episode. It does not modify
the example directory.

```bash
mirai compile examples/mirai-governed-runtime-minimal/program.mirai.yaml \
  --out /tmp/read-note.mirai.json
MIRAI_HOME=/tmp/mirai-home mirai run \
  examples/mirai-governed-runtime-minimal/results/program.mirai.json \
  --input examples/mirai-governed-runtime-minimal/input.json \
  --sandbox examples/mirai-governed-runtime-minimal/sandbox
```

Runtime accepts the compiled JSON IR, never the YAML authoring source.
Generated episodes and receipts are host-local. A sanitized export omits file
content, capability tokens, approval signatures and sandbox paths.
