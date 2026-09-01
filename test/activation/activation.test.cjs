const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { resolveActivationPlan, runActivationPlan, simulateActivationPlan, validateActivationPlan } = require("../../dist/cjs/activation");
const { digestValue } = require("../../dist/cjs/core");

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
  assert.equal(first.canonical_write_allowed, false);
  assert.equal(first.learning_update_allowed, false);
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
  assert.match(result.path_results[0].blocker, /activation_program_ref_outside_base/);
});
