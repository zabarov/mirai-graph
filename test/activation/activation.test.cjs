const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { resolveActivationPlan, runActivationPlan, simulateActivationPlan, validateActivationPlan } = require("../../dist/cjs/activation");
const { digestValue } = require("../../dist/cjs/core");
const { DEFAULT_CAPABILITY_POLICY, policyDigest } = require("../../dist/cjs/runtime");

const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/graph-snapshot.json"), "utf8"));
const signal = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/signal.json"), "utf8"));

test("activation plan binds snapshot and produces deterministic dependency frontiers", () => {
  const plans = Array.from({ length: 100 }, () => resolveActivationPlan(snapshot, signal));
  assert.equal(new Set(plans.map((item) => item.digest)).size, 1);
  const simulations = plans.map(simulateActivationPlan);
  assert.equal(new Set(simulations.map((item) => item.trace_digest)).size, 1);
  assert.deepEqual(simulations[0].frontiers, [["path.worker.prepare.operation.execute"], ["path.worker.review.operation.execute"]]);
  assert.equal(simulations[0].effects_executed, false);
  assert.equal(plans[0].canonical_write_allowed, false);
});

test("tampered plans and budget overflow fail closed", () => {
  const plan = resolveActivationPlan(snapshot, signal);
  plan.budgets.max_nodes = 1;
  const result = validateActivationPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.errors.includes("activation_plan_digest_mismatch"), true);
  assert.equal(result.errors.includes("activation_node_budget_exceeded"), true);
});

test("all activation budgets are enforced during plan validation", () => {
  const base = resolveActivationPlan(snapshot, signal);
  const validateBudget = (key, value, expected) => {
    const plan = JSON.parse(JSON.stringify(base));
    plan.budgets[key] = value;
    const { digest: _oldDigest, ...body } = plan;
    plan.digest = digestValue(body);
    assert(validateActivationPlan(plan).errors.includes(expected), `${key} should produce ${expected}`);
  };
  validateBudget("max_depth", 1, "activation_depth_budget_exceeded");
  validateBudget("max_fan_out", 0, "activation_budget_invalid");
  validateBudget("max_iterations", 1, "activation_iteration_budget_exceeded");
  validateBudget("max_parallel", 0, "activation_budget_invalid");
});

test("resolver rejects a snapshot whose content does not match its digest", () => {
  const changed = JSON.parse(JSON.stringify(snapshot));
  changed.components.component_instances[0].scope = "changed";
  assert.throws(() => resolveActivationPlan(changed, signal), /graph_snapshot_digest_mismatch/);
});

test("applicable inhibitor blocks a component path", () => {
  const changed = JSON.parse(JSON.stringify(snapshot));
  changed.relation_facts.push({
    contract_version: "1.0.0", id: "relation.inhibit_review", type: "inhibits",
    participants: [{ ref: "worker.review", role: "blocked_component" }, { ref: "policy.pause", role: "governing_policy" }],
    scope: "demo", conditions: { risk: "normal" }, priority: 200, authority: "owner_asserted", confidence: 1,
    provenance: [{ source_ref: "source.pause" }], activation_rule: { signal_type: "work_requested", operation: "operation.execute" }
  });
  changed.graph_snapshot_digest = digestValue({ id: changed.id, components: changed.components, relation_facts: changed.relation_facts });
  const plan = resolveActivationPlan(changed, signal);
  assert.equal(plan.activated_paths.length, 1);
  assert.equal(plan.blocked_paths.some((item) => item.reason === "inhibited_by_relation:relation.inhibit_review"), true);
});

test("context mismatch blocks relation fact without silently changing dispatch", () => {
  const changed = { ...signal, values: { risk: "high" } };
  const plan = resolveActivationPlan(snapshot, changed);
  assert.deepEqual(plan.selected_relation_fact_ids, []);
  assert.equal(plan.blocked_relation_facts[0].reason, "context_not_applicable");
  assert.deepEqual(simulateActivationPlan(plan).frontiers, [["path.worker.prepare.operation.execute", "path.worker.review.operation.execute"]]);
});

test("activation runner executes immutable paths through the governed runtime deterministically", async () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-run-"));
  const first = await runActivationPlan(plan, {
    base_dir: path.resolve(__dirname, "../.."),
    sandbox: path.join(root, "sandbox-a"),
    home: path.join(root, "home-a")
  });
  const second = await runActivationPlan(plan, {
    base_dir: path.resolve(__dirname, "../.."),
    sandbox: path.join(root, "sandbox-b"),
    home: path.join(root, "home-b")
  });
  assert.equal(first.status, "completed");
  assert.equal(first.aggregate_trace_digest, second.aggregate_trace_digest);
  assert.deepEqual(first.frontiers, [["path.worker.prepare.operation.execute"], ["path.worker.review.operation.execute"]]);
  assert.equal(first.path_results.every((item) => item.status === "completed"), true);
  assert.equal(first.path_results.every((item) => item.effects_executed === false), true);
  assert.equal(first.effects_executed, false);
  assert.equal(first.effective_policy_digest, policyDigest(DEFAULT_CAPABILITY_POLICY));
  assert.match(first.host_budget_ceilings_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.canonical_write_allowed, false);
  assert.equal(first.learning_update_allowed, false);
});

test("activation runner rejects a policy digest mismatch before creating runtime state", async () => {
  const plan = resolveActivationPlan(snapshot, signal);
  plan.policy_digest = `sha256:${"f".repeat(64)}`;
  const { digest: _oldDigest, ...body } = plan;
  plan.digest = digestValue(body);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-policy-"));
  const home = path.join(root, "home");
  await assert.rejects(
    () => runActivationPlan(plan, { base_dir: path.resolve(__dirname, "../.."), sandbox: path.join(root, "sandbox"), home }),
    /activation_policy_digest_mismatch/
  );
  assert.equal(fs.existsSync(home), false);
});

test("activation runner enforces trusted host budget ceilings before creating runtime state", async () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-ceiling-"));
  const home = path.join(root, "home");
  await assert.rejects(
    () => runActivationPlan(plan, {
      base_dir: path.resolve(__dirname, "../.."), sandbox: path.join(root, "sandbox"), home,
      host_budget_ceilings: { ...plan.budgets, max_nodes: 1 }
    }),
    /activation_host_budget_ceiling_exceeded:max_nodes/
  );
  assert.equal(fs.existsSync(home), false);
});

test("activation runner blocks a program digest mismatch before execution", async () => {
  const plan = resolveActivationPlan(snapshot, signal);
  plan.activated_paths[0].program_digest = `sha256:${"f".repeat(64)}`;
  const { digest: _oldDigest, ...body } = plan;
  plan.digest = digestValue(body);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-tamper-"));
  const result = await runActivationPlan(plan, {
    base_dir: path.resolve(__dirname, "../.."),
    sandbox: path.join(root, "sandbox"),
    home: path.join(root, "home")
  });
  assert.equal(result.status, "blocked");
  assert.match(result.path_results[0].blocker, /activation_program_digest_mismatch/);
  assert.match(result.path_results[1].blocker, /activation_dependency_not_completed/);
});

test("activation runner rejects program references outside its base directory", async () => {
  const plan = resolveActivationPlan(snapshot, signal);
  plan.activated_paths[0].program_ref = "../outside.mirai.yaml";
  const { digest: _oldDigest, ...body } = plan;
  plan.digest = digestValue(body);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-path-"));
  const result = await runActivationPlan(plan, {
    base_dir: path.resolve(__dirname, "../.."),
    sandbox: path.join(root, "sandbox"),
    home: path.join(root, "home")
  });
  assert.equal(result.status, "blocked");
  assert.match(result.path_results[0].blocker, /activation_program_ref_outside_root/);
});

test("activation runner rejects symlinked program references", async (context) => {
  if (process.platform === "win32") return context.skip("symlink fixture is POSIX-specific");
  const plan = resolveActivationPlan(snapshot, signal);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-symlink-"));
  const outside = path.join(root, "outside.mirai.yaml");
  fs.copyFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/worker.mirai.yaml"), outside);
  const base = path.join(root, "base");
  fs.mkdirSync(base);
  fs.symlinkSync(outside, path.join(base, "linked.mirai.yaml"));
  plan.activated_paths[0].program_ref = "linked.mirai.yaml";
  const { digest: _oldDigest, ...body } = plan;
  plan.digest = digestValue(body);
  const result = await runActivationPlan(plan, { base_dir: base, sandbox: path.join(root, "sandbox"), home: path.join(root, "home") });
  assert.equal(result.status, "blocked");
  assert.match(result.path_results[0].blocker, /activation_program_ref_symlink_forbidden/);
});

test("activation runner rejects a program below a symlinked parent directory", async (context) => {
  if (process.platform === "win32") return context.skip("symlink fixture is POSIX-specific");
  const plan = resolveActivationPlan(snapshot, signal);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-activation-parent-symlink-"));
  const outside = path.join(root, "outside");
  fs.mkdirSync(outside);
  fs.copyFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/worker.mirai.yaml"), path.join(outside, "worker.mirai.yaml"));
  const base = path.join(root, "base");
  fs.mkdirSync(base);
  fs.symlinkSync(outside, path.join(base, "linked-directory"));
  plan.activated_paths[0].program_ref = "linked-directory/worker.mirai.yaml";
  const { digest: _oldDigest, ...body } = plan;
  plan.digest = digestValue(body);
  const result = await runActivationPlan(plan, { base_dir: base, sandbox: path.join(root, "sandbox"), home: path.join(root, "home") });
  assert.equal(result.status, "blocked");
  assert.match(result.path_results[0].blocker, /activation_program_ref_symlink_forbidden/);
});
