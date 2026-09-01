# Mirai 2 External Review Packet

Status: preparation contract; no external verdicts recorded

## Purpose

This document defines the next evidence step without treating internal
engineering acceptance as independent or blinded review. It is a packaging
contract for a study custodian and reviewers, not a completed study result.

## Roles

- The **run operator** executes frozen conditions and cannot score outcomes.
- The **study custodian** replaces condition and runtime identifiers with
  opaque bundle ids, checks redaction and preserves the sealed mapping.
- The **outcome reviewer** scores only the blinded output, required outcome,
  rubric and public-safe evidence supplied in the bundle.
- The **analysis owner** receives scores before the condition mapping is
  unsealed and records missing or unusable observations.

One person must not combine run operator and outcome reviewer roles for the
same task. A reviewer must declare conflicts before receiving a packet.

## Packet Contents

Each reviewer packet must contain:

1. an opaque task and bundle id;
2. the same task statement and acceptance rubric used by every condition;
3. the observable output or patch;
4. sanitized evidence needed to score mandatory-step adherence;
5. an explicit list of unavailable evidence;
6. a score sheet based on the metric dictionary;
7. no condition id, runtime name, model name, graph/version label, token count,
   path, timestamps or commentary that reveals the condition.

The existing engineering pilot directories are source material for the
custodian. They are not directly blinded packets because their paths and
documents identify the Mirai condition.

## Reviewer Output

The reviewer records, before unsealing:

- technology-adherence score and item-level decisions;
- task-correctness score;
- skipped mandatory steps;
- unsupported assumptions;
- false-completion claims;
- correction-loop count observable from the packet;
- audit completeness;
- `reviewable`, `partially_reviewable` or `not_reviewable`;
- short evidence-grounded rationale;
- conflict declaration and reviewer pseudonym.

Reviewers do not decide whether Mirai should be released and do not infer
system quality from hidden implementation details.

## Custodian Checks

Before distribution, the custodian must verify:

- every condition for one task uses the same rubric and target outcome;
- filenames and text do not expose condition or model identity;
- redaction does not remove evidence needed by the rubric;
- failed, blocked and interrupted runs remain in the sample;
- packet digest and sealed condition mapping are recorded separately;
- no secrets, private paths, raw environment values or customer data remain.

## Promotion Boundary

Three blinded reviews of the current engineering pilots close only the human
review gate. They do not estimate variance. Beta promotion additionally needs
comparable runs across all control conditions. Stable release and scientific
claims still require power analysis, a frozen confirmatory design and the
remaining release gates in `releases/2.0.0-readiness.json`.
