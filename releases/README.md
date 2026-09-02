# Mirai Release Process

Status: stable 1.0 release process

## Purpose

This directory records public release notes for Mirai and the Mirai Graph 1.x
compatibility line.

Release notes must separate:

- what changed;
- what was validated;
- what remains limited;
- which claims are supported by the current evidence.

## Release Notes

- [v2.2.0-alpha.1](2.2.0-alpha.1.md) - local development release preparation
  for the Autonomic Fabric; not tagged, published or stable.
- [Mirai 2.2 alpha readiness](2.2.0-alpha.1-readiness.json) - explicit passed,
  blocked and not-run gates for eventual `2.2.0` promotion.
- [v2.1.0](2.1.0.md) - stable production-read software release combining the
  frozen execution core, graph-native 2.1 contracts, Project Capsule,
  independent conformance and compatibility wrappers.
- [v2.1.0-rc.1](2.1.0-rc.1.md) - production-read release candidate combining
  the security-frozen Mirai 2.0 execution core with graph-native 2.1 contracts,
  Project Capsule and compatibility wrappers.
- [Mirai 2.0 stable readiness](2.0.0-readiness.json) - machine-readable passed,
  blocked and not-run promotion gates; the overall `2.0.0` verdict remains
  blocked.
- [v2.0.0-alpha.3](2.0.0-alpha.3.md) - capability-gated reference adapters,
  durable execution, recovery, governed replay and sanitized evidence.
- [v2.0.0-alpha.2](2.0.0-alpha.2.md) - deterministic pure interpreter,
  replay and portable language conformance corpus.
- [v2.0.0-alpha.1](2.0.0-alpha.1.md) - typed Mirai Program contracts,
  deterministic compiler and proposal-only 1.4 migration.
- [v1.4.1](1.4.1.md) - repository maintenance and versioning baseline for
  Mirai 2.0 development; not currently published to npm.
- [v1.4.0](1.4.0.md) - executable technology and deterministic Course Pack
  projection.
- [v1.2.0](1.2.0.md) - portable task-boundary project continuity in Project
  Technology.
- [v1.1.0](1.1.0.md) - universal sequential context traversal and usage
  verification in Project Technology.
- [v1.0.0](1.0.0.md) - stable Project Technology, CLI and public contract.
- [v1.3.0](1.3.0.md) - immutable artifact releases in Project Technology.
- [v1.0.0-rc.6](1.0.0-rc.6.md) - anti-drift / quality-control release
  consolidation across Semantic Intent, Dynamic Episode, Goal Vector and
  Technology Quality Feedback.
- [v1.0.0-rc.5](1.0.0-rc.5.md) - Semantic Intent Resolution input-control
  contract release candidate.
- [v1.0.0-rc.4](1.0.0-rc.4.md) - Dynamic Episode proposal/experimental
  tracing release candidate.
- [v1.0.0-rc.3](1.0.0-rc.3.md) - developer-first onboarding release
  candidate.
- [v1.0.0-rc.2](1.0.0-rc.2.md) - self-service onboarding and public
  documentation hardening release candidate.
- [v1.0.0-rc.1](1.0.0-rc.1.md) - 1.0 release candidate consolidating the
  public standard, profiles, executable process control, instrumentation,
  Character Layer, self-service onboarding, adopter kit and evidence
  boundaries.
- [Societal Governance profile proposal](societal-governance-profile-proposal.md)
  - proposal-level transfer note for the public-safe experimental governance
  profile; not a core `1.0.0` profile requirement.
- [v0.1.0-alpha.9](0.1.0-alpha.9.md) - Mirai Graph naming, repository,
  package and CLI identity consolidation.
- [v0.1.0-alpha.10](0.1.0-alpha.10.md) - Adopter Workflow, release-state
  reporting and self-service starter path.
- [v0.1.0-alpha.11](0.1.0-alpha.11.md) - Instrumentation release candidate for
  development cockpits, feature traceability and multi-source quality feedback.

## Release Checklist

Before creating a tag:

1. Move relevant `CHANGELOG.md` entries from `[Unreleased]` to the target
   version.
2. Update `package.json` version.
3. Add `releases/<version>.md`.
4. Run:

```bash
npm run release:check
npm run validate:release-state
```

5. Run a public-safety scan for private paths and obvious secrets.
6. Verify `git diff --check`.
7. Commit release preparation.
8. Create an annotated tag:

```bash
git tag -a v<version> -m "Mirai Graph <version>"
```

9. Push `main` and the tag.
10. Publish GitHub Release notes using `releases/<version>.md`.
11. After the GitHub Release exists, run:

```bash
node packages/cli/mirai-graph.js release state --markdown
node packages/cli/mirai-graph.js release state --require-github-release --markdown
```

The release-state report must distinguish GitHub Release state, npm registry
state and npm authentication state. A missing npm login or pending npm package
publication is a blocker for npm publish, not permission to expose credentials.

## GitHub Release Notes

GitHub Release notes should use the matching file from this directory.

They should include:

- release type;
- summary;
- added or changed artifacts;
- validation command and expected result;
- important limitations.

Do not claim:

- peer review;
- real-world productivity improvement;
- external validity;
- runtime safety;
- universal applicability;

unless the release includes evidence that directly supports that claim.

## Public-Safety Scan

Use a targeted scan over public files before release. Keep local private-path
and credential patterns outside committed documentation:

```bash
rg -n "<local-private-path-pattern>|<credential-pattern>|<restricted-data-pattern>" .github README.md ROADMAP.md CHANGELOG.md docs standard schemas benchmarks examples packages profiles pilots publications releases package.json .env.example .gitignore
```

Review matches manually. Maintainers may add local private-path patterns to
their own release checklist, but local filesystem paths and exact credential
patterns should not be embedded in public release notes.

## Version Policy

Product/package, graph manifest and extension contract versions are
independent. See [Versioning](../docs/versioning.md).

During alpha:

- patch alpha releases may include schema, CLI, documentation and synthetic
  evidence changes;
- release notes must state limitations;
- tags should not be rewritten after publication.

For `1.0.0-rc.*`:

- the package may be reviewed as a release candidate;
- release notes must still state limitations and publication boundaries;
- final `1.0.0` requires a separate tag, GitHub Release and npm publication
  decision after release-state checks.
