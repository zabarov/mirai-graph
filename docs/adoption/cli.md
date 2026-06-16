# Mirai Graph CLI

Status: 1.0 release-candidate CLI guide

Mirai Graph keeps the reference scripts for direct automation. The
`mirai-graph` entrypoint is the primary command surface for common checks and
reports.

## Commands

Detect an existing project without writing files:

```bash
npx mirai-graph detect . --markdown
```

Create a bootstrap proposal without canonical writes:

```bash
npx mirai-graph bootstrap . --mode suggest --markdown
```

Initialize a starter package:

```bash
npx mirai-graph init . --profile software_specification
```

List profile choices:

```bash
npx mirai-graph choose-profile
```

Print an adopter plan for a role or profile:

```bash
npx mirai-graph adopter plan developer
npx mirai-graph adopter plan organization_governance
```

Generate a readable adopter report for a starter template:

```bash
npx mirai-graph adopter report templates/software-project-starter
```

Validate a package:

```bash
npx mirai-graph validate examples/minimal-graph
```

Generate a Markdown validation report:

```bash
npx mirai-graph report validation examples/minimal-graph
```

Explain a process transition:

```bash
npx mirai-graph explain process-transition examples/process-transition-minimal/state-machine.json examples/process-transition-minimal/transition-request.json
```

Generate a dynamic episode trace report:

```bash
npx mirai-graph report dynamic-episode examples/dynamic-episode-minimal/results/dynamic-episode-trace.json
```

Generate the playground report:

```bash
npx mirai-graph report playground
```

Check the external release state without publishing:

```bash
npx mirai-graph release state --markdown
npm run validate:release-state
```

## Output Boundary

- JSON output is intended for tools and CI.
- Markdown output is intended for human review.
- `detect` is read-only.
- `bootstrap --mode suggest` writes proposal/evidence only.
- `init` creates starter graph files and refuses to overwrite by default.
- Adopter workflow output is a starting aid, not adoption proof.
- Dynamic episode reports explain operational behavior. They do not expose
  hidden model reasoning and do not authorize canonical updates.
- A passing report is evidence for the checked artifact only.
- A release-state report checks package, git tag, GitHub Release, npm registry
  and npm auth state, but it does not publish or authorize a release.
- Generated context, evidence, feedback and proposals do not authorize
  canonical updates.

## Command Aliases

The `mirai_graph` entrypoint is an underscore alias for environments where a
hyphenated command name is inconvenient. New documentation and automation
should prefer `npx mirai-graph ...` for adopter projects and
`node packages/cli/mirai-graph.js ...` for repository checkout maintenance.
