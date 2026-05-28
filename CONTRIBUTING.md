# Contributing To GrowGraph

GrowGraph is an open research, standardization and developer-adoption project.

Contributions should improve one of these areas:

- standard clarity;
- schemas and validation;
- public-safe examples;
- synthetic benchmarks;
- adoption guides;
- documentation quality;
- reproducibility.

## Public-Safe Rule

Do not contribute:

- private company or client materials;
- internal chats;
- secrets or access details;
- private repository paths;
- customer or employee data;
- unapproved internal metrics;
- unsupported claims of external validation.

Use synthetic, public or explicitly approved material.

## Evidence Rule

Claims should match their evidence level.

Synthetic examples can support method inspection and reproducibility of example
calculations. They cannot support claims about external validity, real-world
performance or universal superiority.

## Standard Contributions

When changing standard text:

1. State the affected section.
2. Explain whether the change is normative or explanatory.
3. Add or update examples.
4. Add or update schemas/tests when the change affects validation.

## Code Contributions

Run before submitting:

```bash
npm run release:check
```

The current test suite validates:

- package, seed, profile and pilot validation;
- context-pack generation;
- readiness scoring;
- synthetic context-reduction calculation;
- negative fixtures;
- whitespace checks.

## Release Contributions

Release preparation must follow [Release Process](releases/README.md).

Do not publish release notes that imply stronger evidence than the repository
contains.

## Documentation Style

- Prefer clear definitions over marketing claims.
- Separate facts, assumptions, examples and limitations.
- Keep public examples synthetic unless source approval is explicit.
- Do not describe preprints as peer-reviewed publications unless the venue
  record confirms peer-reviewed status.
