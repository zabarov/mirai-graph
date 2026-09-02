# Mirai 2.2 Controlled Observe Pilot Review

Status: passed with nonblocking limitations

Reviewed revision: `dd3e2bcfed8045226fdf833dec606794c022b64c`

## Decision

An isolated AI-assisted reviewer who did not implement the runner or its
corrections reviewed the committed controlled-pilot evidence. The initial
review blocked the gate. One bounded correction round closed the output-path,
provenance and validator findings, after which the reviewer returned
`pass_with_nonblocking_findings`.

This is owner-authorized independent AI-assisted review. It is not external
human peer review and does not authorize release or production writes.

## What Was Verified

- The runner can create only one new JSON evidence file in an allowed temporary
  root and cannot overwrite an existing file.
- The output cannot overlap a scanned source directory.
- Git state and deterministic source snapshots are measured before and after
  every case; any change blocks the run.
- Runner source, Git revision, runtime modules, dependency lock, configuration
  and runtime identity are represented by revision data or digests.
- The validator rejects unknown fields, altered effect claims, changed source
  state, changed snapshots, unknown operations and observed-practice promotion.
- Four negative fixtures pass and are part of `npm run release:check`.
- All four committed cases remained `observe_suggest`, performed no production
  effect and allowed no technology draft.

## Limits

- Three private source trees were dirty at observation time, although their
  measured state did not change during the run.
- Private source inputs cannot be publicly reconstructed from digests.
- The pilot evidence does not prove extraction correctness, benefit, external
  validity or scientific effectiveness.
- The effect audit is application-level rather than an independent syscall
  trace.

The machine-readable result is
[`independent-review.json`](independent-review.json).
