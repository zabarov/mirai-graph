# Mirai Graph Practice And Science Program

Status: working program model

## Purpose

Mirai Graph should develop as both:

- a practical graph methodology used in real AI-assisted work;
- a scientific research program that produces publishable evidence, standards
  and reproducible artifacts.

The practical `$graph` skill is the implementation and methodology laboratory.
The public Mirai Graph repository is the standardization, adoption and research
artifact layer.

## Operating Role

The maintainer role is not only to write theory.

The role is to act as a research engineer / scientific collaborator who:

- observes practical graph use;
- detects methodological gaps;
- improves standard definitions;
- helps implementation mature;
- designs measurable experiments;
- records evidence and limitations;
- prepares publication-ready artifacts;
- prevents overclaiming;
- keeps public materials safe and reusable.

## Three-Layer Model

### 1. Practical Layer

Source:

`$graph` skill and real project usage.

Purpose:

- convert scattered information into object graphs;
- build graph seeds and graph embryos;
- generate AI context packs;
- validate readiness;
- run practical rollout workflows;
- discover tooling and methodology gaps.

Output examples:

- object and relation candidates;
- extraction reports;
- generated context packs;
- graph readiness dashboards;
- benchmark runs;
- method improvement candidates.

### 2. Public Standard Layer

Source:

This repository.

Purpose:

- define implementation-independent terminology;
- define schemas and conformance levels;
- publish public-safe examples;
- maintain adoption guides;
- provide validators and reference tooling;
- separate standard from one private implementation.

Output examples:

- standard sections;
- schemas;
- CLI validator;
- examples;
- synthetic benchmark packages;
- profiles;
- conformance reports.

### 3. Scientific Layer

Source:

Research workspace, public-safe evidence and publications.

Purpose:

- formulate research questions;
- design experiments;
- compare baselines;
- record evidence levels;
- prepare manuscripts;
- publish reproducibility packages;
- handle limitations and reviewer objections.

Output examples:

- experiment protocols;
- validation results;
- evidence inventories;
- literature maps;
- preprints;
- journal manuscripts;
- response-to-review tables.

The current public evidence framing is maintained in
`docs/research/scientific-evidence-package.md`.

## Core Development Loop

Mirai Graph development should follow this loop:

```text
practical use
-> observed gap
-> classify gap
-> update implementation, standard or research plan
-> validate with tests or experiment
-> publish public-safe artifact
-> feed lessons back into practice
```

## Gap Classification

Every significant finding should be classified as:

- `local_gap`: specific to one project or example;
- `profile_gap`: belongs to a Mirai Graph profile;
- `standard_gap`: should change the public standard;
- `tooling_gap`: needs validator, generator, migration or CLI work;
- `research_gap`: needs protocol, evidence or independent validation;
- `publication_gap`: needs clearer writing, citations, limitations or data.

## Measurement Discipline

Do not assume graph mode is better. Measure it.

Recommended evaluation cycle:

```text
freeze benchmark
-> measure current mode
-> convert selected scope to graph mode
-> measure graph mode
-> compare
-> optimize
-> validate
-> scale
```

Minimum metrics:

- time to relevant context;
- context size;
- context precision;
- missed dependencies;
- wrong assumptions;
- rework cycles;
- evidence coverage;
- time to done;
- manual review overhead.

## Research Artifact Policy

Every important practical improvement should produce at least one durable
research artifact:

- experiment protocol;
- benchmark fixture;
- result note;
- evidence table;
- limitation note;
- standard change proposal;
- publication note.

If no artifact is produced, the learning remains anecdotal.

## Public Transfer Policy

Not every practical `$graph` detail belongs in the public standard.

Promote only material that is:

- reusable beyond one private project;
- public-safe;
- evidence-bounded;
- implementation-independent or clearly marked as reference tooling;
- useful for adoption, validation or publication.

Keep private:

- raw project materials;
- internal chats;
- secrets;
- customer or employee data;
- private skill internals that are not approved for release.

## Immediate Program Priorities

1. Map existing `$graph` capabilities to Mirai Graph public standard sections.
2. Identify which `$graph` features are standard concepts, profile concepts or
   implementation details.
3. Create a public-safe standard gap report.
4. Add schemas for context packs and profiles.
5. Create a benchmark protocol that compares text-first and graph-assisted
   workflows.
6. Prepare a validation roadmap for future publications.

## Scientific Guardrails

- Do not claim universal validity from internal use.
- Do not treat synthetic benchmark results as field validation.
- Do not confuse product usefulness with scientific proof.
- Do not publish private implementation details without approval.
- Do not describe a preprint as peer reviewed unless the venue confirms it.

## Working Verdict

Mirai Graph should be developed as a research-engineering program:

```text
practice-led, evidence-bounded, standard-oriented and publication-aware
```

The practical `$graph` skill is a source of real operational pressure and
method gaps. The public Mirai Graph repository turns reusable lessons into a
standard, tooling and scientific evidence.
