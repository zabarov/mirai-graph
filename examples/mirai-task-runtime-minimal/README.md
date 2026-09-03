# Program And Recorded AI Tasks

Status: Mirai 2.3 local development preview, not a published release.

One pure Program classifies a request. A recorded AI receiver then uses the
verified classification to produce a draft. The owner authorizes execution;
neither worker authorizes acceptance. The final task status is `incomplete`
until an independent review accepts the exact results.

This is a deterministic integration fixture, not a live model evaluation.
The Program computes both risk branches. The recorded response matches only
the exact task, input, context view and dependency digests. No model API is
called and no fallback response is synthesized.

## Validate Without Writing

From a built checkout:

```bash
node packages/cli/mirai.js task validate examples/mirai-task-runtime-minimal/registry.json
node packages/cli/mirai.js program validate examples/mirai-task-runtime-minimal/main.mirai.json
```

`registry.json` is explicit host configuration, not a capability grant. It pins
the graph, task policy, fixed plan, pure Program and recording by canonical JSON
content digests. All references must remain within this example directory.
The loader rejects symlinks, traversal, duplicate keys, unknown provider types,
arbitrary code fields and oversized content. A pure Program receiver may declare
`programs` as a map from imported Program IDs to the same digest-bound JSON file
references. The complete closure must be pure and pinned (at most 64 imports).
It cannot load JavaScript modules, follow remote imports or replace a child at
runtime. Missing, unused or conflicting imports fail before execution.

## Run In An Isolated Local Home

Review `approval-requests.json` before signing. It is a list of unsigned requests,
not an approval. The following commands create only host-local state and require
the operator's explicit authorization. Set `MIRAI_HOME` to a new empty local
directory and `MIRAI_SANDBOX` to a separate empty directory first. Do not reuse
the fixture run ID for another execution in the same home.

```bash
node packages/cli/mirai.js approval create examples/mirai-task-runtime-minimal/main.mirai.json --sandbox "$MIRAI_SANDBOX" --requests examples/mirai-task-runtime-minimal/approval-requests.json --approver owner --out "$MIRAI_HOME/approval.json"
node packages/cli/mirai.js run examples/mirai-task-runtime-minimal/main.mirai.json --sandbox "$MIRAI_SANDBOX" --runtime-config examples/mirai-task-runtime-minimal/runtime-config.json --task-registry examples/mirai-task-runtime-minimal/registry.json --run-id run.task-demo --apply --approval "$MIRAI_HOME/approval.json"
node packages/cli/mirai.js task inspect run.task-demo --task-registry examples/mirai-task-runtime-minimal/registry.json
node packages/cli/mirai.js resume run.task-demo --task-registry examples/mirai-task-runtime-minimal/registry.json
```

The outer Program completes its four operations. Both tasks are completed with
verified receipts, but their acceptance remains pending. `task inspect` is
read-only and returns summaries, not provider inputs or drafts. Resume must use
the same registry and does not repeat verified work.

The synthetic owner name is not an identity service. Production hosts must
authenticate their operators and protect the local approval-signing authority.
The fixture cannot install network or shell providers. The wider SDK supports
host-injected receivers, whose isolation remains the host's responsibility.

## Reproduce

```bash
npm run test:mirai-2.3
node packages/cli/generate-task-runtime-fixture.js --check
```

The tests exercise public CLI validation, unsigned-request signing, denial
without approval, mixed execution, read-only inspection, restart deduplication
and adversarial registry input. No graph update is performed.
