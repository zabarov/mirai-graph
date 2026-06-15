# Recovery And Resume

Status: 1.0 release-candidate standard section

## Purpose

Recovery and resume rules make governed work resumable after interruption,
context loss, failed commands, dirty worktrees, missing access or failed
validation without relying on chat memory.

## Resume Principle

Resume from durable artifacts:

- workflow or process record;
- launch or reservation record;
- branch and commit state;
- validation result;
- evidence pack;
- sync proposal;
- blockers;
- next safe command;
- rollback option.

Do not resume by guessing from conversation history.

## Required Resume Record

A resume record should include:

- current state;
- last good commit or durable checkpoint;
- current branch or workspace id;
- target object or work scope;
- launch/reservation reference;
- last validation result;
- evidence status;
- blockers;
- next safe command;
- rollback option;
- whether human confirmation is required.

## Schema

Machine-readable resume records can be validated with:

```text
schemas/recovery-resume-record.schema.json
```
