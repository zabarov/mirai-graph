# Mirai Graph Release Process

Status: initial public process

## Purpose

This directory records public release notes for Mirai Graph tags.

Release notes must separate:

- what changed;
- what was validated;
- what remains limited;
- which claims are supported by the current evidence.

## Release Checklist

Before creating a tag:

1. Move relevant `CHANGELOG.md` entries from `[Unreleased]` to the target
   version.
2. Update `package.json` version.
3. Add `releases/<version>.md`.
4. Run:

```bash
npm run release:check
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

During alpha:

- patch alpha releases may include schema, CLI, documentation and synthetic
  evidence changes;
- release notes must state limitations;
- tags should not be rewritten after publication.
