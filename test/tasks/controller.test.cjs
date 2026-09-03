const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createTaskPolicy, prepareTaskPlan, programTaskReceiver, replayTasks, TaskHost } = require("../../dist/cjs/tasks");
const { RunStore } = require("../../dist/cjs/runtime");
const { compileProgramSource } = require("../../dist/cjs/program");
const { digestValue } = require("../../dist/cjs/core");
const { createGraphSnapshot, projectAccessibleSnapshot } = require("../../dist/cjs/stdlib");
const { snapshot, oracle } = require("../fixtures/graph-organization.cjs");

const recordType = { kind: "record", fields: { value: "string" } };
function setup(t, options = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-tasks-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const graph = projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
  const policy = createTaskPolicy({ id: "policy.tasks", owner: "owner", reviewers: ["reviewer"],
    participants: ["owner", "worker.a", "worker.b", "worker.c"].map(id => ({ id, object_ids: [...oracle.accessible], source_ids: ["source.shared"], delegate_to: ["worker.a", "worker.b", "worker.c"] })),
    max_depth: 1, max_tasks: 16, max_parallel: 2, max_duration_ms: 10000, max_output_bytes: 10000, max_model_calls: options.max_model_calls ?? 3 });
  const observed = { calls: [], auth: [], active: 0, peak: 0 };
  const receivers = ["worker.a", "worker.b", "worker.c"].map(id => ({ id, kind: "ai", digest: digestValue(id), input_type: recordType, output_type: recordType,
    async execute(input, context) {
      observed.calls.push(id); observed.active++; observed.peak = Math.max(observed.peak, observed.active);
      assert.equal(JSON.stringify(context.view).includes("private"), false);
      try {
        if (options.delays) await new Promise(resolve => setTimeout(resolve, options.delays[id] || 0));
        if (options.execute) return await options.execute(id, input, context);
        return { output: input, evidence: [{ id: "evidence.done", digest: digestValue(input) }] };
      } finally { observed.active--; }
    } }));
  const requests = receivers.map((r, i) => ({ id: `task.${i}`, parent_id: null, receiver_id: r.id, receiver_digest: r.digest,
    object_ids: ["requirements.a"], input: { value: `result.${i}` }, dependencies: [], required_evidence: ["evidence.done"],
    deadline: new Date(Date.now() + 60000).toISOString(), outcome: "Return the requested value with evidence" }));
  const hostOptions = { home: path.join(root, "home"), sandbox: path.join(root, "sandbox"), graph, policy, receivers,
    authorize: request => { observed.auth.push(request); return options.authorize ? options.authorize(request) : true; },
    ...(options.fault_injection ? { fault_injection: options.fault_injection } : {}) };
  const plan = prepareTaskPlan("plan.local", graph, policy, requests, receivers);
  return { root, graph, policy, observed, receivers, requests, hostOptions, plan, host: new TaskHost(hostOptions) };
}

test("parallel local tasks share references, stay bounded and require independent acceptance", async t => {
  const x = setup(t, { delays: { "worker.a": 15, "worker.b": 1 } });
  const run = x.host.create(x.plan);
  const ledger = await x.host.runReady(run);
  assert.equal(Object.values(ledger.tasks).every(r => r.state === "completed"), true);
  assert.equal(x.observed.peak, 2);
  assert.equal(x.host.collect(run).status, "incomplete");
  for (const task of Object.values(ledger.tasks)) {
    assert.throws(() => x.host.accept(run, task.request.id, task.request.receiver_id, task.result_digest, "accepted"), /reviewer_not_allowed/);
    assert.throws(() => x.host.accept(run, task.request.id, "reviewer", digestValue("stale"), "accepted"), /result_mismatch/);
    x.host.accept(run, task.request.id, "reviewer", task.result_digest, "accepted");
  }
  assert.equal(x.host.collect(run).status, "accepted");
  assert.equal(x.observed.auth.filter(r => r.action === "accept").every(r => r.verdict === "accepted"), true);
  assert.equal(x.host.create(x.plan), run);
  await x.host.runReady(run);
  assert.equal(x.observed.calls.length, 3);
});

test("host denial happens before runtime state creation or any provider invocation", t => {
  const x = setup(t, { authorize: () => false });
  assert.throws(() => x.host.create(x.plan), /authorization_denied/);
  assert.equal(fs.existsSync(x.hostOptions.home), false);
  assert.deepEqual(x.observed.calls, []);
});

test("published task run survives interruption after creation without resetting its ledger or deadline", async t => {
  const x = setup(t, { fault_injection: "after_creation" });
  assert.throws(() => x.host.create(x.plan), /crash_after_creation/);
  const store = new RunStore(x.hostOptions.home, { create: false });
  const run = x.host.runId(x.plan);
  assert.ok(store.listRunIds().includes(run));
  const before = x.host.inspect(run);
  assert.equal(Object.values(before.tasks).every(task => task.state === "submitted"), true);
  const recovered = new TaskHost({ ...x.hostOptions, fault_injection: undefined });
  assert.equal(recovered.create(x.plan), run);
  assert.deepEqual(recovered.inspect(run), before);
  await recovered.runReady(run);
  assert.equal(x.observed.calls.length, 3);
  assert.equal(recovered.inspect(run).deadline_at, before.deadline_at);
});

test("receiver scope, nested authority, deadlines, digests and cyclic dependencies fail closed", t => {
  const x = setup(t);
  for (const mutate of [
    rs => { rs[0].object_ids = ["private.a"]; },
    rs => { rs[0].receiver_digest = digestValue("different"); },
    rs => { rs[1].parent_id = rs[0].id; rs[2].parent_id = rs[1].id; },
    rs => { rs[0].dependencies = [{ task_id: rs[1].id, requires: "verified" }]; rs[1].dependencies = [{ task_id: rs[0].id, requires: "verified" }]; },
    rs => { rs[0].required_evidence = []; },
    rs => { rs[0].input.value = 2; }
  ]) {
    const requests = structuredClone(x.requests); mutate(requests);
    assert.throws(() => prepareTaskPlan("invalid.plan", x.graph, x.policy, requests, x.receivers));
  }
  const nested = structuredClone(x.requests); nested[1].parent_id = nested[0].id;
  assert.doesNotThrow(() => prepareTaskPlan("nested.plan", x.graph, x.policy, nested, x.receivers));
  nested[1].object_ids = ["safety.a"];
  assert.throws(() => prepareTaskPlan("invalid.plan", x.graph, x.policy, nested, x.receivers), /parent_scope_exceeded/);
});

test("downstream accepted dependency waits for exact acceptance and receives verified output", async t => {
  const x = setup(t, { execute: async (id, input, context) => {
    if (id === "worker.b") assert.deepEqual(context.dependencies["task.0"].output, { value: "result.0" });
    return { output: input, evidence: [{ id: "evidence.done", digest: digestValue(input) }] };
  } });
  x.requests[1].dependencies = [{ task_id: "task.0", requires: "accepted" }];
  const plan = prepareTaskPlan("dependent.plan", x.graph, x.policy, x.requests, x.receivers);
  const run = x.host.create(plan); const first = await x.host.runReady(run);
  assert.equal(first.tasks["task.1"].state, "submitted");
  x.host.accept(run, "task.0", "reviewer", first.tasks["task.0"].result_digest, "accepted");
  assert.equal((await x.host.runReady(run)).tasks["task.1"].state, "completed");
});

test("model-call budget is shared across workers and cannot be multiplied by fan-out", async t => {
  const x = setup(t, { max_model_calls: 1 }); const run = x.host.create(x.plan);
  await assert.rejects(x.host.runReady(run), /model_budget_exceeded/);
  assert.equal(x.observed.calls.length, 1);
  assert.equal(x.host.inspect(run).reserved_model_calls, 1);
});

test("missing evidence blocks completion and automatic retries", async t => {
  const x = setup(t, { execute: async (_id, input) => ({ output: input, evidence: [] }) });
  const run = x.host.create(x.plan); const ledger = await x.host.runReady(run);
  assert.equal(ledger.tasks["task.0"].receipt_state, "uncertain");
  assert.equal(x.host.collect(run).status, "incomplete");
  const count = x.observed.calls.length;
  await assert.rejects(x.host.runReady(run), /reconcile_required/);
  assert.equal(x.observed.calls.length, count);
});

test("restart after recorded output reconciles without re-executing that task", async t => {
  const x = setup(t, { fault_injection: "after_output" });
  const run = x.host.create(x.plan);
  await assert.rejects(x.host.runReady(run), /injected_crash_after_output/);
  const before = [...x.observed.calls];
  const recovered = new TaskHost({ ...x.hostOptions, fault_injection: undefined });
  await assert.rejects(recovered.runReady(run), /reconcile_required/);
  for (const task of Object.values(recovered.inspect(run).tasks).filter(r => r.receipt_state === "executed"))
    recovered.reconcileRecordedOutput(run, task.request.id, "owner");
  await recovered.runReady(run);
  for (const id of before) assert.equal(x.observed.calls.filter(x => x === id).length, 1);
});

test("restart after reservation cannot presume no effect occurred", async t => {
  const x = setup(t, { fault_injection: "after_reservation" });
  const run = x.host.create(x.plan);
  await assert.rejects(x.host.runReady(run), /injected_crash_after_reservation/);
  const recovered = new TaskHost({ ...x.hostOptions, fault_injection: undefined });
  await assert.rejects(recovered.runReady(run), /reconcile_required/);
  assert.throws(() => recovered.reconcileRecordedOutput(run, "task.0", "owner"), /evidence_missing/);
  assert.deepEqual(x.observed.calls, []);
});

test("cancel prevents pending dispatch and never counts completed work as accepted", async t => {
  const x = setup(t); const run = x.host.create(x.plan);
  x.host.cancel(run, "owner");
  await x.host.runReady(run);
  assert.deepEqual(x.observed.calls, []);
  assert.equal(x.host.collect(run).status, "incomplete");
});

test("RunStore extension state preserves CAS, isolation, digest and read-only behavior", async t => {
  const x = setup(t); const run = x.host.create(x.plan);
  const store = new RunStore(x.hostOptions.home, { create: false });
  const state = store.readExtensionState(run, "task-ledger");
  assert.throws(() => store.updateExtensionState(run, "task-ledger", null, () => ({})), /compare_and_swap/);
  assert.throws(() => store.updateExtensionState(run, "../program", null, () => ({})), /name_invalid/);
  const another = new RunStore(x.hostOptions.home, { create: false });
  const lease = store.acquireLease(run);
  try { assert.throws(() => another.updateExtensionState(run, "task-ledger", state.digest, value => value), /fenced/); }
  finally { store.releaseLease(run, lease.token); }
  const target = path.join(store.directory(run), "extensions", "task-ledger.json");
  const body = JSON.parse(fs.readFileSync(target, "utf8")); body.value.reserved_model_calls = -1;
  fs.writeFileSync(target, JSON.stringify(body));
  assert.throws(() => x.host.inspect(run), /digest_mismatch/);
});

test("Program receiver uses the existing pure interpreter, not an invented executor", async t => {
  const x = setup(t);
  const program = compileProgramSource(JSON.stringify({ id: "program.worker", version: "1.0.0", entry: "done",
    inputs: [{ id: "value", type: "string" }], outputs: [{ id: "value", type: "string" }],
    nodes: [{ id: "done", kind: "return", values: { value: { op: "ref", path: "input.value" } } }],
    policies: { budgets: { max_steps: 2, max_depth: 1, max_iterations: 1, max_parallel: 1, max_duration_ms: 1000 }, allowed_effects: ["pure"], canonical_write_allowed: false }
  }), "worker.mirai.json").program;
  const receiver = programTaskReceiver({ id: "worker.a", program, evidence_id: "evidence.done" });
  const request = { ...x.requests[0], receiver_digest: receiver.digest };
  const plan = prepareTaskPlan("program.plan", x.graph, x.policy, [request], [receiver]);
  const host = new TaskHost({ ...x.hostOptions, receivers: [receiver] });
  const run = host.create(plan); const ledger = await host.runReady(run);
  assert.deepEqual(ledger.tasks[request.id].result.output, { value: "result.0" });
  assert.equal(ledger.reserved_model_calls, 0);
});

test("recorded replay invokes no providers, reproduces decisions and does not grant authority", async t => {
  const x = setup(t); const run = x.host.create(x.plan);
  const ledger = await x.host.runReady(run);
  for (const task of Object.values(ledger.tasks)) x.host.accept(run, task.request.id, "reviewer", task.result_digest, "accepted");
  const record = x.host.replayRecord(run);
  const neverExecute = x.receivers.map(r => ({ ...r, execute: () => { throw new Error("replay must not invoke providers"); } }));
  const reports = Array.from({ length: 100 }, () => replayTasks(record, x.graph, x.policy, neverExecute));
  assert.equal(new Set(reports.map(r => r.digest)).size, 1);
  assert.equal(reports[0].recorded_completion, true);
  assert.equal(reports[0].authority_verified, false);
  assert.equal(reports[0].provider_calls, 0);
  assert.equal(x.observed.calls.length, 3);
});

test("chronological replay verifies every transition without calls and rejects reordered or omitted history", async t => {
  const x = setup(t); const run = x.host.create(x.plan);
  const ledger = await x.host.runReady(run);
  for (const task of Object.values(ledger.tasks)) x.host.accept(run, task.request.id, "reviewer", task.result_digest, "accepted");
  const history = x.host.historyReplayRecord(run);
  assert.equal(history.ledger.contract_version, "1.2.0");
  assert.equal(history.ledger.history.length, 12);
  const report = replayTasks(history, x.graph, x.policy, x.receivers);
  assert.equal(report.verification, "chronological_recorded_transitions");
  assert.equal(report.authority_verified, false); assert.equal(report.provider_calls, 0);
  assert.equal(report.recorded_completion, true);
  const reseal = record => { const { digest, ...body } = record; record.digest = digestValue(body); return record; };
  for (const mutate of [
    r => r.ledger.history.reverse(),
    r => r.ledger.history.splice(0, 1),
    r => { r.ledger.history[0].kind = "verify"; const { digest, ...body } = r.ledger.history[0]; r.ledger.history[0].digest = digestValue(body); },
    r => { r.ledger.history = []; },
    r => { delete r.ledger.history; }
  ]) {
    const bad = structuredClone(history); mutate(bad);
    assert.throws(() => replayTasks(reseal(bad), x.graph, x.policy, x.receivers), /task_history/);
  }
  assert.equal(x.observed.calls.length, 3);
  assert.equal(x.host.replayRecord(run).ledger.contract_version, "1.0.0", "legacy structural projection remains supported");
});

test("cross-host cancellation is fenced and local cancellation rejects a late provider result", async t => {
  let start, finish;
  const started = new Promise(resolve => { start = resolve; });
  const completion = new Promise(resolve => { finish = resolve; });
  const x = setup(t, { execute: async (_id, input) => { start(); await completion; return { output: input, evidence: [{ id: "evidence.done", digest: digestValue(input) }] }; } });
  const run = x.host.create(x.plan);
  const pending = x.host.runTask(run, x.requests[0].id, "ai");
  await started;
  const other = new TaskHost(x.hostOptions);
  assert.throws(() => other.cancel(run, "owner"), /fenced/, "a different host cannot mutate a live leased run");
  x.host.cancel(run, "owner");
  finish();
  await assert.rejects(pending, /reconcile_required/);
  assert.equal(other.collect(run).status, "incomplete");
  const record = other.historyReplayRecord(run);
  assert.equal(record.ledger.cancelled, true);
  assert.equal(record.ledger.tasks[x.requests[0].id].receipt_state, "uncertain");
  assert.equal(record.ledger.tasks[x.requests[0].id].result, undefined);
  assert.equal(replayTasks(record, x.graph, x.policy, x.receivers).recorded_completion, false);
});

test("replay rejects semantically forged records even with recomputed outer hashes", async t => {
  const x = setup(t); const run = x.host.create(x.plan);
  await x.host.runReady(run);
  const source = x.host.replayRecord(run);
  for (const mutate of [
    r => { r.ledger.tasks["task.0"].idempotency_key = digestValue("forged"); },
    r => { r.ledger.tasks["task.0"].result.output = { value: 3 }; },
    r => { r.ledger.tasks["task.0"].acceptance = "accepted"; },
    r => { r.ledger.tasks["task.0"].receipt_state = "uncertain"; },
    r => { r.ledger.reserved_model_calls = 0; },
    r => { delete r.ledger.tasks["task.0"].result; },
    r => { r.ledger.tasks["task.extra"] = r.ledger.tasks["task.0"]; }
  ]) {
    const record = structuredClone(source); mutate(record);
    const { digest, ...body } = record; record.digest = digestValue(body);
    assert.throws(() => replayTasks(record, x.graph, x.policy, x.receivers));
  }
});

test("provider timeouts fail closed and stop the next frontier", async t => {
  const x = setup(t, { execute: async (_id, input, context) => {
    await new Promise(resolve => context.signal.addEventListener("abort", resolve, { once: true }));
    return { output: input, evidence: [{ id: "evidence.done", digest: digestValue(input) }] };
  } });
  x.requests.forEach(r => { r.deadline = new Date(Date.now() + 300).toISOString(); });
  const plan = prepareTaskPlan("timeout.plan", x.graph, x.policy, x.requests, x.receivers);
  const run = x.host.create(plan);
  const ledger = await x.host.runReady(run);
  assert.equal(ledger.tasks["task.0"].receipt_state, "uncertain");
  assert.equal(ledger.tasks["task.2"].state, "submitted");
  assert.equal(x.observed.calls.length, 2);
  assert.equal(replayTasks(x.host.replayRecord(run), x.graph, x.policy, x.receivers).recorded_completion, false);
});

test("duplicate receivers cannot be hidden by Map normalization", t => {
  const x = setup(t);
  assert.throws(() => new TaskHost({ ...x.hostOptions, receivers: [x.receivers[0], x.receivers[0]] }), /duplicate_task_receiver/);
  assert.throws(() => new TaskHost({ ...x.hostOptions, receivers: [{ ...x.receivers[0], kind: "unrecognized" }] }), /receiver_descriptor_invalid/);
});

test("cancellation interrupts waiting even if a provider ignores abort", async t => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const x = setup(t, { execute: async () => { entered(); return new Promise(() => {}); } });
  const run = x.host.create(x.plan);
  const running = x.host.runReady(run);
  await started;
  const cancelStarted = Date.now();
  x.host.cancel(run, "owner");
  const ledger = await running;
  assert.ok(Date.now() - cancelStarted < 2000, "cancel must interrupt waiting, not await the provider deadline");
  assert.equal(ledger.cancelled, true);
  assert.equal(ledger.tasks["task.2"].state, "cancelled");
  assert.equal(x.observed.calls.length, 2);
  assert.equal(x.host.collect(run).status, "incomplete");
});

test("sharing object ids does not authorize dependency results based on a private relation", t => {
  const x = setup(t);
  const { digest, ...input } = x.graph;
  input.sources.push({ id: "source.private_relation", owner_ref: "owner", confidentiality: "restricted", digest: digestValue("private.relation") });
  input.relations.push({ contract_version: "1.0.0", id: "private.relation", type: "depends_on", participants: [
    { role: "consumer", ref: "requirements.a" }, { role: "dependency", ref: "safety.a" }
  ], priority: 0, authority: "derived", confidence: 1, provenance: [{ source_ref: "source.private_relation" }], scope: "client.a" });
  const graph = createGraphSnapshot(input);
  const { digest: policyDigest, ...rawPolicy } = x.policy;
  for (const participant of rawPolicy.participants) if (["owner", "worker.a"].includes(participant.id)) participant.source_ids.push("source.private_relation");
  const policy = createTaskPolicy(rawPolicy);
  const requests = x.requests.slice(0, 2).map(r => ({ ...r, object_ids: ["requirements.a", "safety.a"] }));
  requests[1].dependencies = [{ task_id: requests[0].id, requires: "verified" }];
  assert.throws(() => prepareTaskPlan("private.dependency", graph, policy, requests, x.receivers), /dependency_source_leak/);
});

test("per-task dispatch supports bounded parallel calls and cross-host fencing", async t => {
  const x = setup(t, { delays: { "worker.a": 30, "worker.b": 30 } }); const run = x.host.create(x.plan);
  const a = x.host.runTask(run, "task.0", "ai");
  const other = new TaskHost(x.hostOptions);
  await assert.rejects(other.runTask(run, "task.2", "ai"), /lease/);
  const b = x.host.runTask(run, "task.1", "ai");
  await Promise.all([a, b]);
  assert.equal(x.observed.peak, 2);
  assert.equal(x.host.inspect(run).tasks["task.2"].state, "submitted", "one dispatch never runs another frontier implicitly");
});
