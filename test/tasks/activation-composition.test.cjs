const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveActivationPlan, runActivationPlan } = require("../../dist/cjs/activation");
const { compileProgramSource } = require("../../dist/cjs/program");
const { digestValue } = require("../../dist/cjs/core");
const { RunStore, DEFAULT_CAPABILITY_POLICY } = require("../../dist/cjs/runtime");
const snapshot = require("../../examples/mirai-activation-minimal/graph-snapshot.json");
const signal = require("../../examples/mirai-activation-minimal/signal.json");
const literal = value => ({ op: "literal", value });
function setup(t, parallel = true) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-activation-composition-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const program = compileProgramSource(JSON.stringify({ id: "program.concurrent-read", version: "1.0.0", entry: "read",
    inputs: [{ id: "message", type: "string" }], outputs: [{ id: "message", type: "string" }], nodes: [
      { id: "read", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read_file" }, args: { path: literal("note.txt") }, effects: ["repository_read"], capability: "capability.repository.read", next: "done" },
      { id: "done", kind: "return", values: { message: { op: "ref", path: "input.message" } } }
    ], policies: { budgets: { max_steps: 4, max_depth: 2, max_iterations: 2, max_parallel: 2, max_duration_ms: 10000 }, allowed_effects: ["repository_read"], canonical_write_allowed: false }
  }), "reader.mirai.json").program;
  fs.writeFileSync(path.join(root, "reader.mirai.json"), JSON.stringify(program));
  const plan = resolveActivationPlan(snapshot, parallel ? { ...signal, values: { risk: "high" } } : signal);
  for (const p of plan.activated_paths) { p.program_ref = "reader.mirai.json"; p.program_digest = program.digest; }
  const { digest, ...body } = plan; plan.digest = digestValue(body);
  return { root, plan, program };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test("existing activation frontiers actually overlap, retain deterministic joins and still use capabilities", async t => {
  const x = setup(t); const digests = [];
  const ids = x.plan.activated_paths.map(p => p.id).sort();
  for (const [index, order] of [ids, [...ids].reverse()].entries()) {
    let active = 0, peak = 0; const both = deferred(); const releases = Object.fromEntries(ids.map(id => [id, deferred()]));
    const completed = [];
    const adapters = { repository: { read_file: { effect: "repository_read", async execute(_args, context) {
      const id = path.basename(context.sandbox);
      active++; peak = Math.max(peak, active); if (active === 2) both.resolve();
      try { await releases[id].promise; completed.push(id); return { content: "synthetic read", canonical_write_allowed: false }; }
      finally { active--; }
    }, async verify() { return { verified: true, details: ["synthetic read verified"] }; } } } };
    const home = path.join(x.root, `home.${index}`);
    const pending = runActivationPlan(x.plan, { base_dir: x.root, sandbox: path.join(x.root, `sandbox.${index}`), home,
      adapters, input: { message: "original" } });
    let timer, overlapError;
    try {
      await Promise.race([both.promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("frontier_did_not_overlap")), 3000); })]);
      releases[order[0]].resolve(); await new Promise(resolve => setTimeout(resolve, 5)); releases[order[1]].resolve();
    } catch (error) { overlapError = error; }
    finally { clearTimeout(timer); for (const release of Object.values(releases)) release.resolve(); }
    const result = await pending;
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.ifError(overlapError);
    assert.equal(peak, 2); assert.deepEqual(completed, order); assert.equal(result.status, "completed");
    assert.equal(result.frontiers.length, 1); digests.push(result.aggregate_trace_digest);
    const store = new RunStore(home, { create: false });
    for (const p of result.path_results) {
      const receipts = store.listReceipts(p.run_id);
      assert.equal(receipts.length, 1); assert.equal(receipts[0].status, "verified");
      assert.equal(store.readEpisode(p.run_id).outputs.message, "original");
    }
  }
  assert.equal(new Set(digests).size, 1);
});

test("caller mutations during an activation cannot change a later frontier or its input/policy", async t => {
  const x = setup(t, false); const originalDigest = x.plan.digest; const input = { message: "original" };
  const policy = structuredClone(DEFAULT_CAPABILITY_POLICY); let calls = 0;
  const adapters = { repository: { read_file: { effect: "repository_read", async execute() {
    calls++;
    if (calls === 1) {
      input.message = "changed"; policy.rules = [];
      x.plan.activated_paths[1].program_digest = digestValue("substituted");
      x.plan.join.policy = "quorum"; x.plan.join.quorum = 200;
      adapters.repository.read_file.execute = async () => { throw new Error("caller_rebound_adapter"); };
    }
    return { content: "synthetic" };
  }, async verify() { return { verified: true, details: [] }; } } } };
  const home = path.join(x.root, "home");
  const result = await runActivationPlan(x.plan, { base_dir: x.root, sandbox: path.join(x.root, "sandbox"), home, input, policy, adapters });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(calls, 2); assert.equal(result.plan_digest, originalDigest); assert.equal(result.status, "completed");
  const store = new RunStore(home, { create: false });
  for (const p of result.path_results) assert.equal(store.readEpisode(p.run_id).outputs.message, "original");
});

test("multi-run activation cannot install task adapters and multiply one plan's shared budget", async t => {
  const x = setup(t); const sandbox = path.join(x.root, "sandbox");
  const operation = { effect: "inference_invoke", async execute() { throw new Error("must not run"); }, async verify() { return { verified: false, details: [] }; } };
  for (const adapters of [{ mirai_tasks: {} }, { renamed: { inference: operation } }]) {
    await assert.rejects(runActivationPlan(x.plan, { base_dir: x.root, sandbox, adapters }), /shared_task_budget_not_supported/);
    assert.equal(fs.existsSync(sandbox), false);
  }
});
