# Mirai 2.3 Local Verification Scope

Status: local development evidence, not a stable release or production approval.

This extension is developed separately from the unfinished 2.2 baseline. The
package version remains the baseline version until an explicit release batch.
No installed Federation, remote repository or npm publication is changed.

The local integration also includes the pending 2.2 compatibility work for
declared-source inventory without Git and checksum-bound provider archives.
An archive still requires a separately trusted consumer-side anchor. It cannot
authenticate itself or grant execution authority. Existing Capsule continuity
and source export checks run alongside the new graph/task checks.

## Requirement Map

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Typed graph operations and immutable references | `src/stdlib` | `test/stdlib`, generated catalog fixtures |
| Overlapping rule, neighborhood and model-proposed views | `src/knowledge/clusters.ts` | `test/knowledge/clusters.test.cjs`, separate Python corpus |
| No implicit authority from membership | authorized projections and attenuated task context | source/object/relation leak negatives |
| Bounded Program and AI delegation | `src/tasks`, existing Runtime bridge | controller, bridge and public CLI tests |
| Calls to pinned subprograms | pure receiver import closure | computation, digest, alias and budget tests |
| Actual parallel work with deterministic outcomes | TaskHost and existing activation frontiers | barrier-held overlap and reversed-completion tests |
| Separate completion and acceptance | result-bound reviewer gate | premature acceptance and dependency negatives |
| Durable state, recovery and replay | existing RunStore CAS, TaskLedger history | initialization, cancellation, uncertain receipts, duplicate resume |
| Public data-only host setup | `--task-registry` | confined path, duplicate-key, size, digest and no-code tests |
| Backward compatibility | opt-in contracts; legacy defaults unchanged | existing Program, Runtime, 2.1, 2.2 and CLI suites |

No new profile, arbitrary evaluator or duplicate component model is introduced.
`graph.propose_patch` and clustering produce proposals, never canonical writes.
Task effects do not grant production access or modify autonomy envelopes.

## Reproduction

```bash
npm run build
npm run test:mirai-2.3
npm run pilot:graph-organization
npm run pilot:graph-computed
npm run release:check
```

The independent Python implementation is supplied explicitly:

```bash
node packages/cli/run-graph-computed-pilot.js --out <new-local-evidence-directory>
npm run validate:graph-organization-conformance -- --bundle <evidence-directory>/conformance.json --checker <checker-checkout> --python <python-executable>
npm run validate:graph-program-conformance -- --checker <checker-checkout> --python <python-executable>
```

When running the Python checker's own tests, explicitly set `MIRAI_REPO` to
the tested product checkout and `MIRAI_ORGANIZATION_BUNDLE` to its generated
`conformance.json`. Do not inherit an installed Federation's older Mirai path.
The checker must use the same schemas and fixtures as the integration target;
missing inputs are a failed test setup, not a passing compatibility result.

The organization corpus has 26 positive/negative cases. The Program 1.1
static-binding corpus has 18. Both implementations must match the expected
verdict, not merely each other. Schemas/catalogs are shared contract data;
the Python implementation does not import the TypeScript implementation or
execute providers. Schema references are resolved locally without network access.
Agreement on these 44 cases is not full formal equivalence of both runtimes.

## Pilot Interpretation

The original frozen pilot checks three constant-output assignments and real
public-document fingerprints with authored topic metadata. The computed pilot
adds four risk/load cases, three specialists, nested arithmetic Programs and
threshold branches. Each condition must match an independently written simple
arithmetic oracle. The graph-resolved condition also produces an exact recorded
AI summary after specialist acceptance; missing acceptance blocks that summary.

Fixed assignment, explicit Program 1.0 and graph-resolved tasks use the same
current interpreter. This is not an independently installed historical version
comparison. Ordinary Program `parallel` is still serial in the reference
interpreter. Separate TaskHost/activation tests prove overlap, not a statistical
performance advantage. Recorded inference proves integration and context binding,
not model quality, savings, or autonomous organizational design.

## Local Safety Review

Reviewed boundaries include confined registry loading, exact registry/plan and
program digests, default-deny capabilities, signed approval scope, inherited
context attenuation, shared budgets, receipt recovery and immutable inputs.
One review correction freezes a pure receiver's evidence identifier at creation;
later mutation of its setup object cannot change evidence under the same digest.
Activation snapshots plan/input/policy/options before asynchronous work and
rejects sandbox-name collisions and task adapters that could multiply budgets.

Known limits are explicit:

- This is an implementation-side review, not independent human security review.
- In-process host providers are trusted code, not isolated hostile executables.
  Cancellation stops waiting but cannot forcibly terminate arbitrary callbacks.
- Early unindexed Runtime directory allocation can leave a fail-closed orphan.
  Initialization after index publication retains the task ledger and deadline.
- Record hashes prove consistency, not external evidence truth, authenticated
  time, human review or real-world authorization by themselves.
- Activation paths have separate Runtime instances. Task adapters are rejected
  there; TaskHost owns shared-budget task fan-out.
- Remote providers, paid experiments, cross-platform certification and
  production rollout are not performed by this local track.

Passing `release:check` also validates the existing blocked readiness record;
it does not turn that record into approval for a stable release.
