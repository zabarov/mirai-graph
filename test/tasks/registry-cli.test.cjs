const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { digestValue } = require("../../dist/cjs/core");
const { loadTaskRuntimeRegistry, taskRuntimeRegistryDigest, recordedTaskReceiver } = require("../../dist/cjs/tasks");
const { RunStore, executePure } = require("../../dist/cjs/runtime");
const fixture = path.resolve(__dirname, "../../examples/mirai-task-runtime-minimal");
const cli = path.resolve(__dirname, "../../packages/cli/mirai.js");
const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v));
function setup(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-task-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = path.join(root, "fixture"); fs.cpSync(fixture, files, { recursive: true });
  const home = path.join(root, "home"), sandbox = path.join(root, "sandbox"); fs.mkdirSync(sandbox);
  const registry = path.join(files, "registry.json"), program = path.join(files, "main.mirai.json");
  const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 30000,
    env: { ...process.env, MIRAI_HOME: home } });
  return { root, files, home, sandbox, registry, program, invoke };
}
function inventory(dir) {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const full = path.join(dir, name);
    return fs.lstatSync(full).isDirectory() ? inventory(full).map(([p, v]) => [`${name}/${p}`, v]) : [[name, fs.readFileSync(full).toString("base64")]];
  });
}
function success(result) { assert.equal(result.status, 0, result.stderr || result.stdout); return JSON.parse(result.stdout); }

test("registry and CLI validation are read-only, relocatable and digest-bound", t => {
  const x = setup(t); const before = inventory(x.root);
  const result = success(x.invoke("task", "validate", x.registry));
  assert.equal(result.valid, true); assert.equal(result.network_enabled, false);
  assert.equal(result.task_count, 2); assert.equal(result.canonical_write_allowed, false);
  assert.deepEqual(result.provider_modes, ["pure_program", "recorded_ai"]);
  assert.equal(result.registry_digest, taskRuntimeRegistryDigest(loadTaskRuntimeRegistry(path.join(fixture, "registry.json"))));
  assert.deepEqual(inventory(x.root), before);
  const graphPath = path.join(x.files, "graph.json"); const graph = read(graphPath); graph.id = "graph.changed"; write(graphPath, graph);
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /content_digest_mismatch/);
});

test("CLI mixed execution requires signed approval and leaves acceptance pending; resume deduplicates", t => {
  const x = setup(t); const config = path.join(x.files, "runtime-config.json");
  const args = ["run", x.program, "--sandbox", x.sandbox, "--runtime-config", config, "--task-registry", x.registry, "--apply"];
  const denied = x.invoke(...args);
  assert.notEqual(denied.status, 0); assert.match(denied.stderr + denied.stdout, /approval_receipt_required/);
  const approval = path.join(x.root, "approval.json");
  success(x.invoke("approval", "create", x.program, "--sandbox", x.sandbox, "--requests", path.join(x.files, "approval-requests.json"),
    "--approver", "owner", "--out", approval));
  const result = success(x.invoke(...args, "--run-id", "run.task-demo", "--approval", approval));
  assert.equal(result.run.status, "completed");
  const store = new RunStore(x.home, { create: false });
  const receipts = store.listReceipts("run.task-demo");
  assert.equal(receipts.length, 4); assert.ok(receipts.every(r => r.status === "verified"));
  assert.equal(receipts.find(r => r.operation === "collect").result.value.status, "incomplete");
  const before = inventory(x.root);
  const inspected = success(x.invoke("task", "inspect", "run.task-demo", "--task-registry", x.registry));
  assert.equal(inspected.status, "incomplete");
  assert.equal(JSON.stringify(inspected).includes("High risk:"), false);
  assert.deepEqual(inventory(x.root), before);
  success(x.invoke("resume", "run.task-demo", "--task-registry", x.registry));
  assert.deepEqual(store.listReceipts("run.task-demo"), receipts);
});

test("recorded receiver binds task, input, context and dependencies without fallback", async () => {
  const definition = read(path.join(fixture, "recording.json")); const receiver = recordedTaskReceiver(definition);
  const registry = loadTaskRuntimeRegistry(path.join(fixture, "registry.json"));
  const { taskContextView } = require("../../dist/cjs/tasks");
  const requests = registry.plans[0].requests;
  const view = taskContextView(registry.graph, registry.policy, requests[1], requests);
  const classification = await registry.receivers[0].execute(requests[0].input, { task_id: requests[0].id, view,
    dependencies: {}, idempotency_key: digestValue("test"), signal: new AbortController().signal });
  const context = { task_id: "task.draft", view, dependencies: { "task.classify": classification }, idempotency_key: digestValue("test"), signal: new AbortController().signal };
  assert.deepEqual(await receiver.execute(requests[1].input, context), definition.recordings[0].result);
  for (const change of [{ task_id: "task.other" }, { view: { ...view, digest: digestValue("other") } }, { dependencies: {} }])
    await assert.rejects(receiver.execute(requests[1].input, { ...context, ...change }), /context_not_found/);
  await assert.rejects(receiver.execute({ request: "different" }, context), /context_not_found/);
  assert.throws(() => recordedTaskReceiver({ ...definition, recordings: [...definition.recordings, ...definition.recordings] }), /ambiguous_case/);
});

test("pure worker computes both branch outcomes rather than replaying a constant", async () => {
  const program = read(path.join(fixture, "worker.mirai.json"));
  for (const [risk, route] of [["high", "review"], ["low", "ordinary"]]) {
    const episode = await executePure(program, { risk });
    assert.equal(episode.outputs.route, route);
  }
});

test("registry rejects traversal, symlinks, arbitrary code, duplicate keys and oversized inputs", t => {
  const x = setup(t); const original = read(x.registry);
  for (const ref of ["../graph.json", "/graph.json", "./graph.json", "nested\\graph.json", "file:graph.json"]) {
    write(x.registry, { ...original, graph: { ...original.graph, path: ref } });
    assert.throws(() => loadTaskRuntimeRegistry(x.registry), /reference|path/);
  }
  fs.symlinkSync(path.join(x.files, "graph.json"), path.join(x.files, "linked.json"));
  write(x.registry, { ...original, graph: { ...original.graph, path: "linked.json" } });
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /symlink/);
  fs.symlinkSync(x.files, path.join(x.files, "linked"));
  write(x.registry, { ...original, graph: { ...original.graph, path: "linked/graph.json" } });
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /symlink/);
  write(x.registry, { ...original, module: "arbitrary.js" });
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /file_invalid/);
  fs.writeFileSync(x.registry, '{"contract_version":"1.0.0","contract_version":"1.0.0"}');
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /json_invalid/);
  fs.writeFileSync(x.registry, "private source fragment invalid json");
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), e => e.message === "task_registry_json_invalid");
  fs.writeFileSync(x.registry, " ".repeat(8 * 1024 * 1024 + 1));
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /budget_exceeded/);
});

test("CLI rejects duplicate, missing and unknown task options without writing", t => {
  const x = setup(t); const before = inventory(x.root);
  for (const args of [
    ["task", "inspect", "run.missing", "--task-registry", x.registry, "--unsafe", "yes"],
    ["task", "inspect", "run.missing", "--task-registry", x.registry, "--task-registry", x.registry],
    ["task", "inspect", "run.missing", "--task-registry"],
    ["run", x.program, "--sandbox", x.sandbox, "--task-registry", x.registry, "--task-registry", x.registry]
  ]) assert.notEqual(x.invoke(...args).status, 0);
  assert.deepEqual(inventory(x.root), before);
});

test("data-only registry loads a pinned pure Program closure through the public CLI", async t => {
  const x = setup(t);
  const { compileProgramSource } = require("../../dist/cjs/program");
  const { programTaskReceiver, prepareTaskPlan } = require("../../dist/cjs/tasks");
  const child = read(path.join(x.files, "worker.mirai.json"));
  const program = compileProgramSource(JSON.stringify({ id: "program.wrapper", version: "1.0.0", entry: "child",
    imports: [{ alias: "risk", ref: child.id, digest: child.digest }], inputs: child.inputs, outputs: child.outputs,
    state: [{ id: "answer", type: { kind: "record", fields: { route: "string" } }, default: { route: "pending" } }],
    nodes: [{ id: "child", kind: "call", target: { kind: "program", program: "risk" }, args: { risk: { op: "ref", path: "input.risk" } }, result: "answer", next: "done" },
      { id: "done", kind: "return", values: { route: { op: "get", target: { op: "ref", path: "state.answer" }, key: "route" } } }],
    policies: { ...child.policies, budgets: { ...child.policies.budgets, max_depth: 4 } }
  }), "wrapper.mirai.json").program;
  const original = loadTaskRuntimeRegistry(x.registry);
  const receiver = programTaskReceiver({ id: "worker.program", program, programs: { [child.id]: child }, evidence_id: "evidence.classification" });
  const requests = [{ ...original.plans[0].requests[0], receiver_digest: receiver.digest }];
  const plan = prepareTaskPlan("plan.closure", original.graph, original.policy, requests, [receiver]);
  const config = read(x.registry);
  write(path.join(x.files, "wrapper.mirai.json"), program); write(path.join(x.files, "task-plan.json"), plan);
  config.plan.content_digest = digestValue(plan);
  config.receivers = [{ kind: "program", id: receiver.id, evidence_id: "evidence.classification",
    program: { path: "wrapper.mirai.json", content_digest: digestValue(program) },
    programs: { [child.id]: { path: "worker.mirai.json", content_digest: digestValue(child) } } }];
  write(x.registry, config);
  const before = inventory(x.root);
  assert.equal(success(x.invoke("task", "validate", x.registry)).valid, true);
  const loaded = loadTaskRuntimeRegistry(x.registry);
  assert.deepEqual((await loaded.receivers[0].execute({ risk: "high" }, { signal: new AbortController().signal })).output, { route: "review" });
  assert.deepEqual(inventory(x.root), before);
  config.receivers[0].programs[child.id].path = "../worker.mirai.json"; write(x.registry, config);
  assert.throws(() => loadTaskRuntimeRegistry(x.registry), /reference_invalid/);
});
