# Mirai Graph For Developers

Status: 1.0 release-candidate developer guide

## Why A Developer Would Use This

Use Mirai Graph when a repository has important project knowledge spread across
README files, tickets, docs, code comments, decisions and AI chats.

Mirai Graph does not replace your code, issue tracker or documentation. It adds
a small graph package that describes:

- what the important project objects are;
- how features, requirements, risks and decisions connect;
- what evidence supports a claim;
- what is blocked or uncertain;
- what an AI assistant should know before helping with implementation.

The goal is practical: make the project easier to understand, validate and hand
to an AI assistant without dumping the whole repository into a prompt.

## Common Developer Use Cases

### 1. Project Onboarding

Create a graph package that helps a new developer answer:

- What are the main features?
- What depends on what?
- What risks or blockers exist?
- Which decisions matter?
- Which evidence or validation exists?

### 2. AI-Assisted Development

Use the graph as structured context for AI:

- relevant features;
- required constraints;
- related risks;
- accepted decisions;
- evidence and missing evidence;
- process gates before claiming work is done.

### 3. Requirement Traceability

Connect requirements to implementation objects, decisions and evidence:

```text
requirement -> feature -> component -> test/evidence -> release gate
```

This makes it easier to explain why a change exists and what should be checked
before it is accepted.

### 4. Dependency And Risk Map

Use relations such as `depends_on`, `blocks`, `implements`, `evidences` and
`governs` to show why a task is not isolated.

### 5. CI Validation

Run validation in CI to make sure graph package structure and profile rules do
not silently break.

Validation does not prove the project is correct. It checks that the graph
package remains structurally usable.

## What You Get

A starter software graph usually looks like this:

```text
mirai-graph-package.json
graph/
  objects.json
  relations.json
gates/
  results.json
```

Example object:

```json
{
  "id": "feature.user_notifications",
  "kind": "feature",
  "title": "User notifications",
  "summary": "Notify users when important workflow events happen.",
  "readiness": "draft",
  "profile": "software_specification",
  "evidence": ["docs/product-notifications.md"]
}
```

Example relation:

```json
{
  "id": "relation.user_notifications.depends_on.event_log",
  "type": "depends_on",
  "source": "feature.user_notifications",
  "target": "feature.event_log",
  "summary": "Notifications require event records before delivery."
}
```

## Quick Start

The intended npm workflow is:

```bash
npm install -D mirai-graph
npx mirai-graph detect . --markdown
npx mirai-graph bootstrap . --mode suggest --markdown
npx mirai-graph init . --profile software_specification
npx mirai-graph validate .
```

Current release-candidate note: if the npm package is not published yet, use the
repository checkout path:

```bash
git clone https://github.com/zabarov/mirai-graph.git
cd mirai-graph
npm install
node packages/cli/mirai-graph.js validate examples/minimal-graph
```

## What The Commands Mean

### `detect`

Read-only scan. It reports:

- whether a graph package already exists;
- which profile is recommended;
- which files are missing;
- what the next safe action is.

### `bootstrap --mode suggest`

Creates a generated proposal. It does not update canonical graph files.

Use this when you want Mirai Graph to suggest what the project graph could look
like before committing to a starter package.

### `init`

Creates the starter package files.

For most software projects, start with:

```bash
npx mirai-graph init . --profile software_specification
```

### `validate`

Checks package structure, object/relation references, profile rules and known
semantic guardrails.

## First Useful Graph

Do not try to model the whole system on day one.

Start with:

- 3-5 features;
- 2-3 requirements;
- 1-2 risks;
- 1-2 decisions;
- evidence links for the most important claims;
- a few relations that change how the project should be understood.

That is enough to make the graph useful for onboarding and AI context.

## How This Helps AI Work

Without a graph, an AI assistant often receives scattered context:

```text
README + issue + old chat + partial code + developer note
```

With Mirai Graph, the assistant can receive a structured map:

```text
task -> relevant features -> dependencies -> risks -> evidence -> gates
```

This reduces missing context and makes it easier to detect false progress, such
as "tests exist" being treated as "work is accepted".

## Boundaries

- Mirai Graph validation is not proof that your software is correct.
- Generated proposals do not update canonical graph state.
- Evidence does not authorize release by itself.
- Feedback does not automatically change the graph.
- Private data, secrets and customer logs should stay outside public graph
  packages.

## Next Steps

- Follow [Connect A Project In 15 Minutes](connect-project-15-minutes.md).
- Read the [CLI Guide](cli.md).
- Add CI with the GitHub Action starter.
- Use [Developer Integration Guide](developer-integration-guide.md) when you
  want to integrate validation into a real repository workflow.
