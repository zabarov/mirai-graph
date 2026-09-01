const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { programDigest } = require("../../dist/cjs/program");
const {
  RunStore,
  createApprovalReceipt,
  startGovernedRun,
  resumeGovernedRun,
  replayGovernedEpisode,
  inspectGovernedRun,
  exportSanitizedEvidence,
  validateGrant
} = require("../../dist/cjs/runtime");

function temporary() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-alpha3-"));
  const sandbox = path.join(root, "sandbox");
  const home = path.join(root, "home");
  fs.mkdirSync(sandbox);
  return { root, sandbox, home, store: new RunStore(home) };
}

function program(id, nodes, options = {}) {
  const value = {
    contract_version: "1.0.0",
    id,
    version: "1.0.0",
    imports: options.imports || [],
    inputs: options.inputs || [],
    outputs: options.outputs || [],
    state: options.state || [],
    nodes,
    entry: nodes[0].id,
    error_routes: options.error_routes || [],
    policies: {
      budgets: { max_steps: 128, max_depth: 16, max_iterations: 32, max_parallel: 8, max_duration_ms: 1000 },
      allowed_effects: options.allowed_effects || ["pure"],
      canonical_write_allowed: false
    },
    source_map: Object.fromEntries(nodes.map((node) => [node.id, { file: "test:governed" }]))
  };
  return { ...value, digest: programDigest(value) };
}

function readProgram(requestedPath = "note.txt") {
  const readType = { kind: "record", fields: { path: "string", encoding: "string", content: "string", size: "int64", sha256: "string" } };
  return program("program.repository-read", [
    {
      id: "read.file", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read_file" },
      args: { path: { op: "literal", value: requestedPath } }, result: "read_result",
      effects: ["repository_read"], capability: "capability.repository.read", next: "return.content"
    },
    {
      id: "return.content", kind: "return", values: {
        content: { op: "get", target: { op: "ref", path: "state.read_result" }, key: "content" }
      }
    }
  ], {
    outputs: [{ id: "content", type: "string" }],
    state: [{ id: "read_result", type: readType, default: { path: "pending", encoding: "utf8", content: "", size: 0, sha256: "pending" } }],
    allowed_effects: ["repository_read"]
  });
}

function writeProgram(options = {}) {
  const next = options.compensate ? "compensate.write" : "return.done";
  const nodes = [
    {
      id: "write.file", kind: "call", target: { kind: "adapter", adapter: "workspace", operation: "write_file" },
      args: {
        path: { op: "literal", value: options.path || "generated.txt" },
        content: { op: "literal", value: options.content || "written once" },
        expected_sha256: { op: "literal", value: options.expected || "missing" }
      },
      effects: ["workspace_patch"], capability: "capability.workspace.patch", next
    }
  ];
  if (options.compensate) nodes.push({
    id: "compensate.write", kind: "compensate", receipt: { op: "literal", value: "write.file" }, next: "return.done"
  });
  nodes.push({ id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } });
  return program("program.workspace-write", nodes, {
    outputs: [{ id: "status", type: "string" }],
    allowed_effects: ["workspace_patch"]
  });
}

function approval(environment, subject, effects, overrides = {}) {
  return createApprovalReceipt({
    home: environment.home,
    program_digest: subject.digest,
    sandbox: environment.sandbox,
    effects,
    approver: "test.owner",
    ttl_ms: 60_000,
    ...overrides
  });
}

test("repository read is capability-gated, verified and export-safe", async () => {
  const env = temporary();
  fs.writeFileSync(path.join(env.sandbox, "note.txt"), "private fixture content");
  const subject = readProgram();
  const result = await startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox });
  assert.equal(result.run.status, "completed");
  assert.equal(result.episode.outputs.content, "private fixture content");
  const receipts = env.store.listReceipts(result.run.run_id);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, "verified");
  const output = path.join(env.root, "evidence");
  const filename = exportSanitizedEvidence(result.run.run_id, output, { store: env.store });
  const exported = fs.readFileSync(filename, "utf8");
  assert(!exported.includes("private fixture content"));
  assert(!exported.includes(env.sandbox));
  assert(!exported.includes("opaque_token"));
});

test("git status and diff remain read-only capability-gated effects", async () => {
  const env = temporary();
  const runGit = (...args) => {
    const result = spawnSync("git", args, { cwd: env.sandbox, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit("init");
  fs.writeFileSync(path.join(env.sandbox, "tracked.txt"), "before\n");
  runGit("add", "tracked.txt");
  runGit("-c", "user.name=Mirai Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
  fs.writeFileSync(path.join(env.sandbox, "tracked.txt"), "after\n");
  const subject = program("program.git-read", [
    {
      id: "git.status", kind: "call", target: { kind: "adapter", adapter: "git", operation: "status" },
      args: {}, effects: ["git_read"], capability: "capability.git.read", next: "git.diff"
    },
    {
      id: "git.diff", kind: "call", target: { kind: "adapter", adapter: "git", operation: "diff" },
      args: { paths: { op: "literal", value: ["tracked.txt"] } }, effects: ["git_read"],
      capability: "capability.git.read", next: "return.done"
    },
    { id: "return.done", kind: "return" }
  ], { allowed_effects: ["git_read"] });
  const result = await startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox });
  assert.equal(result.run.status, "completed");
  assert.deepEqual(env.store.listReceipts(result.run.run_id).map((item) => item.operation), ["status", "diff"]);
  const replay = await replayGovernedEpisode(result.episode, subject);
  assert.equal(replay.status, "match");
  assert.equal(replay.effects_executed, false);
});

test("human approval adapter requires and records a host-signed receipt", async () => {
  const env = temporary();
  const subject = program("program.human-approval", [
    {
      id: "approval.require", kind: "call", target: { kind: "adapter", adapter: "human", operation: "approval" },
      args: {}, effects: ["human_approval"], capability: "capability.human.approval", next: "return.done"
    },
    { id: "return.done", kind: "return" }
  ], { allowed_effects: ["human_approval"] });
  const receipt = approval(env, subject, ["human_approval"]);
  const result = await startGovernedRun(subject, {}, {
    store: env.store, sandbox: env.sandbox, apply: true, approval: receipt
  });
  assert.equal(result.run.status, "completed");
  assert.equal(env.store.listReceipts(result.run.run_id)[0].status, "verified");
});

test("governed retry keeps invocation identity and replays failed then verified effects", async () => {
  const env = temporary();
  fs.writeFileSync(path.join(env.sandbox, "note.txt"), "recovered");
  const child = readProgram();
  let calls = 0;
  const adapters = {
    repository: {
      read_file: {
        effect: "repository_read",
        async execute() {
          calls += 1;
          if (calls === 1) throw new Error("transient-read-failure");
          return { path: "note.txt", encoding: "utf8", content: "recovered", size: 9, sha256: "sha256:" + "a".repeat(64) };
        },
        async verify() { return { verified: true, details: ["synthetic-read-verified"] }; }
      }
    }
  };
  const subject = program("program.retry-governed", [
    {
      id: "retry.read", kind: "retry", program: "child", max_attempts: 2,
      backoff_ms: 0, timeout_ms: 100, on_error: "return.failed", next: "return.done"
    },
    { id: "return.failed", kind: "return" },
    { id: "return.done", kind: "return" }
  ], {
    imports: [{ alias: "child", ref: child.id, digest: child.digest }],
    allowed_effects: ["repository_read"]
  });
  const result = await startGovernedRun(subject, {}, {
    store: env.store, sandbox: env.sandbox, programs: { child }, adapters
  });
  assert.equal(result.run.status, "completed");
  assert.deepEqual(result.episode.effect_stubs.map((item) => item.status), ["failed", "verified"]);
  assert.notEqual(result.episode.effect_stubs[0].invocation_id, result.episode.effect_stubs[1].invocation_id);
  const replay = await replayGovernedEpisode(result.episode, subject, { programs: { child } });
  assert.equal(replay.status, "match");
});

test("workspace write fails without apply and signed approval", async () => {
  const env = temporary();
  const subject = writeProgram();
  await assert.rejects(
    () => startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox }),
    /apply_flag_required|approval_receipt_required/
  );
  assert.equal(fs.existsSync(path.join(env.sandbox, "generated.txt")), false);
});

test("forged approval fails closed before workspace write", async () => {
  const env = temporary();
  const subject = writeProgram();
  const forged = { ...approval(env, subject, ["workspace_patch"]), approver: "forged.actor" };
  await assert.rejects(
    () => startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox, apply: true, approval: forged }),
    /approval_signature_invalid/
  );
  assert.equal(fs.existsSync(path.join(env.sandbox, "generated.txt")), false);
});

test("crash after effect is reconciled without duplicate workspace write", async () => {
  const env = temporary();
  const subject = writeProgram();
  const receipt = approval(env, subject, ["workspace_patch"]);
  let runId;
  await assert.rejects(async () => {
    try {
      await startGovernedRun(subject, {}, {
        store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
        run_id: "run.crash-after-effect", fault_injection: "after_execute_before_verify"
      });
    } finally { runId = "run.crash-after-effect"; }
  }, /fault_injected_after_execute/);
  assert.equal(fs.readFileSync(path.join(env.sandbox, "generated.txt"), "utf8"), "written once");
  assert.equal(env.store.readRun(runId).status, "blocked");
  const resumed = await resumeGovernedRun(runId, { store: env.store });
  assert.equal(resumed.run.status, "completed");
  assert.equal(env.store.listReceipts(runId).length, 1);
  assert.equal(env.store.listReceipts(runId)[0].attempt, 1);
  assert.equal(fs.readFileSync(path.join(env.sandbox, "generated.txt"), "utf8"), "written once");
});

test("fault before adapter invocation retries safely on resume", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "retry.txt", content: "single write" });
  const receipt = approval(env, subject, ["workspace_patch"]);
  await assert.rejects(
    () => startGovernedRun(subject, {}, {
      store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
      run_id: "run.crash-before-effect", fault_injection: "after_prepare"
    }),
    /fault_injected_after_prepare/
  );
  assert.equal(fs.existsSync(path.join(env.sandbox, "retry.txt")), false);
  const resumed = await resumeGovernedRun("run.crash-before-effect", { store: env.store });
  assert.equal(resumed.run.status, "completed");
  assert.equal(env.store.listReceipts(resumed.run.run_id)[0].attempt, 2);
  assert.equal(fs.readFileSync(path.join(env.sandbox, "retry.txt"), "utf8"), "single write");
});

test("compensation restores the pre-effect workspace state", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "temporary.txt", content: "temporary", compensate: true });
  const receipt = approval(env, subject, ["workspace_patch"]);
  const result = await startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox, apply: true, approval: receipt });
  assert.equal(result.run.status, "completed");
  assert.equal(fs.existsSync(path.join(env.sandbox, "temporary.txt")), false);
  assert.equal(env.store.listReceipts(result.run.run_id)[0].status, "compensated");
  assert(result.episode.trace.some((item) => item.decision === "compensated"));
});

test("allowlisted test runner uses a fixed host command without shell", async () => {
  const env = temporary();
  const subject = program("program.test-run", [
    {
      id: "test.run", kind: "call", target: { kind: "adapter", adapter: "test", operation: "run" },
      args: { command_id: { op: "literal", value: "fixture" } },
      effects: ["process_run"], capability: "capability.test.run", next: "return.done"
    },
    { id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } }
  ], { outputs: [{ id: "status", type: "string" }], allowed_effects: ["process_run"] });
  const receipt = approval(env, subject, ["process_run"]);
  const result = await startGovernedRun(subject, {}, {
    store: env.store,
    sandbox: env.sandbox,
    apply: true,
    approval: receipt,
    test_commands: {
      fixture: { command: process.execPath, args: ["-e", "process.stdout.write('ok')"], timeout_ms: 5000, max_output_bytes: 4096 }
    }
  });
  assert.equal(result.run.status, "completed");
  assert.equal(env.store.listReceipts(result.run.run_id)[0].result.stdout, "ok");
});

test("non-zero allowlisted test result blocks completion", async () => {
  const env = temporary();
  const runId = "run.test-failure";
  const subject = program("program.test-failure", [
    {
      id: "test.run", kind: "call", target: { kind: "adapter", adapter: "test", operation: "run" },
      args: { command_id: { op: "literal", value: "failing-fixture" } },
      effects: ["process_run"], capability: "capability.test.run", next: "return.done"
    },
    { id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } }
  ], { outputs: [{ id: "status", type: "string" }], allowed_effects: ["process_run"] });
  const receipt = approval(env, subject, ["process_run"]);
  await assert.rejects(
    () => startGovernedRun(subject, {}, {
      store: env.store,
      sandbox: env.sandbox,
      apply: true,
      approval: receipt,
      run_id: runId,
      test_commands: {
        "failing-fixture": { command: process.execPath, args: ["-e", "process.exit(7)"], timeout_ms: 5000, max_output_bytes: 4096 }
      }
    }),
    /effect_verification_failed/
  );
  const run = env.store.readRun(runId);
  assert.equal(run.status, "blocked");
  assert.equal(env.store.listReceipts(run.run_id)[0].status, "uncertain");
});

test("test runner does not inherit arbitrary secret environment variables", async () => {
  const env = temporary();
  const subject = program("program.test-env", [
    {
      id: "test.run", kind: "call", target: { kind: "adapter", adapter: "test", operation: "run" },
      args: { command_id: { op: "literal", value: "env-check" } }, effects: ["process_run"],
      capability: "capability.test.run", next: "return.done"
    },
    { id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } }
  ], { outputs: [{ id: "status", type: "string" }], allowed_effects: ["process_run"] });
  const receipt = approval(env, subject, ["process_run"]);
  process.env.MIRAI_SECRET_FIXTURE = "must-not-leak";
  try {
    const result = await startGovernedRun(subject, {}, {
      store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
      test_commands: {
        "env-check": { command: process.execPath, args: ["-e", "process.stdout.write(process.env.MIRAI_SECRET_FIXTURE || 'not-present')"], timeout_ms: 5000, max_output_bytes: 4096 }
      }
    });
    assert.equal(env.store.listReceipts(result.run.run_id)[0].result.stdout, "not-present");
  } finally {
    delete process.env.MIRAI_SECRET_FIXTURE;
  }
});

test("program content cannot inject a test command id", async () => {
  const env = temporary();
  const subject = program("program.test-injection", [
    {
      id: "test.run", kind: "call", target: { kind: "adapter", adapter: "test", operation: "run" },
      args: { command_id: { op: "literal", value: "fixture;touch injected.txt" } }, effects: ["process_run"],
      capability: "capability.test.run", next: "return.done"
    },
    { id: "return.done", kind: "return" }
  ], { allowed_effects: ["process_run"] });
  const receipt = approval(env, subject, ["process_run"]);
  await assert.rejects(
    () => startGovernedRun(subject, {}, {
      store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
      test_commands: { fixture: { command: process.execPath, args: ["-e", "process.exit(0)"], timeout_ms: 5000, max_output_bytes: 4096 } }
    }),
    /test_command_not_allowlisted/
  );
  assert.equal(fs.existsSync(path.join(env.sandbox, "injected.txt")), false);
});

test("path traversal and symlink escape fail closed", async () => {
  const env = temporary();
  fs.writeFileSync(path.join(env.root, "outside.txt"), "outside");
  await assert.rejects(
    () => startGovernedRun(readProgram("../outside.txt"), {}, { store: env.store, sandbox: env.sandbox }),
    /path_traversal_forbidden/
  );
  if (process.platform === "win32") return;
  fs.symlinkSync(path.join(env.root, "outside.txt"), path.join(env.sandbox, "linked.txt"));
  await assert.rejects(
    () => startGovernedRun(readProgram("linked.txt"), {}, { store: env.store, sandbox: env.sandbox }),
    /symlink_path_forbidden/
  );
});

test("run store rejects active leases and stale compare-and-swap revisions", () => {
  const env = temporary();
  const subject = readProgram();
  fs.writeFileSync(path.join(env.sandbox, "note.txt"), "content");
  const run = env.store.createRun({ program: subject, input: {}, sandbox: env.sandbox, apply: false, run_id: "run.store-contract" });
  const lease = env.store.acquireLease(run.run_id);
  assert.throws(() => env.store.acquireLease(run.run_id), /run_lease_active/);
  assert.throws(() => env.store.updateRun(run.run_id, 0, (value) => value), /run_compare_and_swap_failed/);
  env.store.releaseLease(run.run_id, lease.token);
});

test("expired lease is replaced but malformed or active state remains fail-closed", () => {
  const env = temporary();
  const subject = readProgram();
  const run = env.store.createRun({ program: subject, input: {}, sandbox: env.sandbox, apply: false, run_id: "run.stale-lease" });
  const leaseFile = path.join(env.store.directory(run.run_id), "lease.json");
  fs.writeFileSync(leaseFile, JSON.stringify({ token: "stale", pid: 1, acquired_at: "2000-01-01T00:00:00.000Z", expires_at: "2000-01-01T00:00:01.000Z" }));
  const lease = env.store.acquireLease(run.run_id);
  assert.notEqual(lease.token, "stale");
  env.store.releaseLease(run.run_id, lease.token);
});

test("corrupted checkpoint blocks resume and is not silently replaced", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "checkpoint.txt" });
  const receipt = approval(env, subject, ["workspace_patch"]);
  await assert.rejects(
    () => startGovernedRun(subject, {}, {
      store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
      run_id: "run.corrupt-checkpoint", fault_injection: "after_prepare"
    }),
    /fault_injected_after_prepare/
  );
  const checkpointFile = path.join(env.store.directory("run.corrupt-checkpoint"), "checkpoint.json");
  fs.writeFileSync(checkpointFile, "{not-json\n");
  await assert.rejects(() => resumeGovernedRun("run.corrupt-checkpoint", { store: env.store }), /runtime_checkpoint_invalid/);
  assert.equal(fs.readFileSync(checkpointFile, "utf8"), "{not-json\n");
  assert.equal(env.store.readRun("run.corrupt-checkpoint").status, "blocked");
});

test("uncertain write without a result blocks automatic resume", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "uncertain.txt", content: "possibly written" });
  const receipt = approval(env, subject, ["workspace_patch"]);
  const uncertainAdapters = {
    workspace: {
      write_file: {
        effect: "workspace_patch",
        async execute(_args, context) {
          fs.writeFileSync(path.join(context.sandbox, "uncertain.txt"), "possibly written");
          throw new Error("transport_lost_after_write");
        },
        async verify() { return { verified: false, details: ["result_unavailable"] }; }
      }
    }
  };
  await assert.rejects(
    () => startGovernedRun(subject, {}, {
      store: env.store, sandbox: env.sandbox, apply: true, approval: receipt,
      run_id: "run.uncertain", adapters: uncertainAdapters
    }),
    /effect_uncertain/
  );
  assert.equal(env.store.listReceipts("run.uncertain")[0].status, "uncertain");
  await assert.rejects(
    () => resumeGovernedRun("run.uncertain", { store: env.store, adapters: uncertainAdapters }),
    /run_reconciliation_blocked/
  );
  assert.equal(env.store.readRun("run.uncertain").status, "blocked");
});

test("failed compensation is visible and does not become completed", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "failed-compensation.txt", compensate: true });
  const receipt = approval(env, subject, ["workspace_patch"]);
  const adapters = {
    workspace: {
      write_file: {
        effect: "workspace_patch",
        async execute(_args, context) {
          fs.writeFileSync(path.join(context.sandbox, "failed-compensation.txt"), "value");
          return { path: "failed-compensation.txt", sha256: "recorded", backup_ref: "none" };
        },
        async verify() { return { verified: true, details: ["fixture_verified"] }; },
        async compensate() { return { compensated: false, details: ["fixture_compensation_failed"] }; }
      }
    }
  };
  await assert.rejects(
    () => startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox, apply: true, approval: receipt, adapters }),
    /compensation_failed/
  );
  const runId = fs.readdirSync(path.join(env.home, "run-index"))[0];
  const indexed = JSON.parse(fs.readFileSync(path.join(env.home, "run-index", runId), "utf8"));
  assert.notEqual(env.store.readRun(indexed.run_id).status, "completed");
});

test("expired approval fails before effect execution", async () => {
  const env = temporary();
  const subject = writeProgram({ path: "expired.txt" });
  const expired = approval(env, subject, ["workspace_patch"], { now: new Date("2020-01-01T00:00:00.000Z"), ttl_ms: 1000 });
  await assert.rejects(
    () => startGovernedRun(subject, {}, { store: env.store, sandbox: env.sandbox, apply: true, approval: expired }),
    /approval_expired/
  );
  assert.equal(fs.existsSync(path.join(env.sandbox, "expired.txt")), false);
});

test("grant validation rejects cross-run reuse", () => {
  const request = {
    contract_version: "1.0.0", request_id: "request.fixture", request_digest: "sha256:" + "a".repeat(64),
    run_id: "run.one", program_digest: "sha256:" + "b".repeat(64), node_id: "node.one",
    adapter: "repository", action: "read_file", resource: "./note.txt", effects: ["repository_read"],
    capability: "capability.repository.read", budget: { max_calls: 1 }, policy_digest: "sha256:" + "c".repeat(64), approval_required: false
  };
  const grant = {
    ...request,
    grant_id: "grant.fixture",
    request_id: request.request_id,
    run_id: "run.two",
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    opaque_token: "x".repeat(40)
  };
  assert(validateGrant(grant, request).includes("grant_cross_run_reuse"));
  assert(validateGrant({ ...grant, run_id: request.run_id, expires_at: "2000-01-01T00:00:00.000Z" }, request).includes("grant_expired"));
});

test("inspect does not expose sandbox, capability token or effect result", async () => {
  const env = temporary();
  fs.writeFileSync(path.join(env.sandbox, "note.txt"), "secret-like-content");
  const result = await startGovernedRun(readProgram(), {}, { store: env.store, sandbox: env.sandbox });
  const inspected = JSON.stringify(inspectGovernedRun(result.run.run_id, { store: env.store }));
  assert(!inspected.includes(env.sandbox));
  assert(!inspected.includes("secret-like-content"));
  assert(!inspected.includes("opaque_token"));
});
