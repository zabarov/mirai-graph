# Mirai Graph CLI

Status: alpha unified entrypoint

Mirai Graph keeps the reference scripts for direct automation. The
`mirai-graph` entrypoint is the primary command surface for common checks and
reports.

## Commands

List profile choices:

```bash
node packages/cli/mirai-graph.js choose-profile
```

Print an adopter plan for a role or profile:

```bash
node packages/cli/mirai-graph.js adopter plan developer
node packages/cli/mirai-graph.js adopter plan organization_governance
```

Generate a readable adopter report for a starter template:

```bash
node packages/cli/mirai-graph.js adopter report templates/software-project-starter
```

Validate a package:

```bash
node packages/cli/mirai-graph.js validate examples/minimal-graph
```

Generate a Markdown validation report:

```bash
node packages/cli/mirai-graph.js report validation examples/minimal-graph
```

Explain a process transition:

```bash
node packages/cli/mirai-graph.js explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
```

Generate the playground report:

```bash
node packages/cli/mirai-graph.js report playground
```

## Output Boundary

- JSON output is intended for tools and CI.
- Markdown output is intended for human review.
- Adopter workflow output is a starting aid, not adoption proof.
- A passing report is evidence for the checked artifact only.
- Generated context, evidence, feedback and proposals do not authorize
  canonical updates.

## Command Aliases

The `mirai_graph` entrypoint is an underscore alias for environments where a
hyphenated command name is inconvenient. New documentation and automation
should prefer
`node packages/cli/validate-mirai-graph.js <package-dir>` or
`node packages/cli/mirai-graph.js ...`.
