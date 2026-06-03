# GrowGraph CLI

Status: alpha unified entrypoint

GrowGraph keeps the original reference scripts for compatibility. The
`growgraph` entrypoint is a thin wrapper that gives adopters a shorter command
surface for common checks and reports.

## Commands

Validate a package:

```bash
node packages/cli/growgraph.js validate examples/minimal-graph
```

Generate a Markdown validation report:

```bash
node packages/cli/growgraph.js report validation examples/minimal-graph
```

Explain a process transition:

```bash
node packages/cli/growgraph.js explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
```

Generate the playground report:

```bash
node packages/cli/growgraph.js report playground
```

## Output Boundary

- JSON output is intended for tools and CI.
- Markdown output is intended for human review.
- A passing report is evidence for the checked artifact only.
- Generated context, evidence, feedback and proposals do not authorize
  canonical updates.

## Compatibility

The wrapper delegates to the existing reference scripts. Existing commands such
as `node packages/cli/validate-growgraph.js <package-dir>` and `npm test`
remain supported.
