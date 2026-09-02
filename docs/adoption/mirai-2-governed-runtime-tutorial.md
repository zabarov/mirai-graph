# Run A Governed Mirai Program

Status: `2.1.0` stable checkout and package tutorial

This tutorial executes a public-safe repository-read Program. It reads one
synthetic file, creates host-local receipts and exports sanitized evidence. It
does not write to the repository, call a network service or update a graph.

## 1. Build And Validate

```bash
npm ci
npm run build
node packages/cli/mirai.js program validate \
  examples/mirai-governed-runtime-minimal/program.mirai.yaml
```

## 2. Compile Deterministic IR

```bash
node packages/cli/mirai.js compile \
  examples/mirai-governed-runtime-minimal/program.mirai.yaml \
  --out /tmp/read-note.mirai.json \
  --force
```

The runtime uses `/tmp/read-note.mirai.json`, not the YAML source.

## 3. Run In An Isolated Host Contour

```bash
MIRAI_HOME=/tmp/mirai-tutorial-home \
node packages/cli/mirai.js run /tmp/read-note.mirai.json \
  --input examples/mirai-governed-runtime-minimal/input.json \
  --sandbox examples/mirai-governed-runtime-minimal/sandbox
```

Record the returned `run_id`. The Program requests `repository_read`; the host
issues only the matching bounded capability.

## 4. Inspect And Export

```bash
MIRAI_HOME=/tmp/mirai-tutorial-home \
node packages/cli/mirai.js inspect <run-id>

MIRAI_HOME=/tmp/mirai-tutorial-home \
node packages/cli/mirai.js evidence export <run-id> \
  --out /tmp/mirai-tutorial-evidence
```

Inspect output is redacted. The evidence export omits file content, capability
tokens, approval material and the sandbox path.

## 5. Replay Without Effects

```bash
node packages/cli/mirai.js replay \
  <run-id> \
  --program /tmp/read-note.mirai.json \
  --home /tmp/mirai-tutorial-home
```

Replay consumes effect stubs and must report that real effects were not
executed. A matching replay proves consistency for this episode only; it does
not prove that an arbitrary Program is correct or production-safe.
