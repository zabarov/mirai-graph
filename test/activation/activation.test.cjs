const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { resolveActivationPlan, simulateActivationPlan, validateActivationPlan } = require("../../dist/cjs/activation");
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
