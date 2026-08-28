# Mirai Graph CLI

Status: 1.1 stable CLI guide

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

Discover and compile task context without writing files:

```bash
npx mirai-graph technology context . --phase discover --task "prepare the release"
npx mirai-graph technology context . --phase expand --input receipt.json --select capability.release
npx mirai-graph technology context . --phase compile --input receipt.json --selection selection.json
npx mirai-graph technology context . --phase verify --packet context-pack.json --evidence usage-evidence.json
```

Versioned file bundles use the same Project Technology entrypoint:

```bash
npx mirai-graph technology artifact inspect . --input incoming.zip
npx mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound
npx mirai-graph technology artifact release . --input incoming.zip --matter-id agreement-main --direction inbound --apply
npx mirai-graph technology artifact compare . --matter-id agreement-main --base-release 20260828-01 --target-release 20260828-02
npx mirai-graph technology artifact verify . --matter-id agreement-main --release-id 20260828-02
```

Inspection, comparison and verification are read-only. Release creation is a
preview until `--apply` is present.

Omitting `--phase` keeps the original bounded context-discovery behavior.
Receipt, selection, context-pack and usage-evidence files are caller-owned
inputs and outputs; the command never stores them itself.

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
- Context traversal never reads secret values into its output. Access is
  represented by a safe reference, availability and required permission.

## Command Aliases

The `mirai_graph` entrypoint is an underscore alias for environments where a
hyphenated command name is inconvenient. New documentation and automation
should prefer `npx mirai-graph ...` for adopter projects and
`node packages/cli/mirai-graph.js ...` for repository checkout maintenance.
