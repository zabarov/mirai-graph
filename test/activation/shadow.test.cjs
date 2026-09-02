const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { evaluateShadowDifferential, resolveActivationPlan } = require("../../dist/cjs/activation");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "examples/mirai-activation-minimal/graph-snapshot.json"), "utf8"));
const signal = JSON.parse(fs.readFileSync(path.join(root, "examples/mirai-activation-minimal/signal.json"), "utf8"));

function baseline(overrides = {}) {
  const value = {
    contract_version: "1.0.0",
    id: "baseline.demo.prepare-review",
    version: "1.0.0",
    source_ref: "source://accepted/prepare-review",
    acceptance: { status: "owner_accepted", evidence_ref: "evidence://owner-review/prepare-review" },
    mandatory_steps: [
      { id: "step.prepare", operation: "operation.execute", component_instance: "worker.prepare", required_effects: [], rollback_required: false },
      { id: "step.review", operation: "operation.execute", component_instance: "worker.review", required_effects: [], rollback_required: false }
    ],
    allowed_scope: {
      component_instances: ["worker.prepare", "worker.review"],
      operations: ["operation.execute"],
      capabilities: ["pure"],
      effects: []
    },
    rollback_coverage: [],
    canonical_write_allowed: false,
    ...overrides
  };
  value.digest = digestValue(value);
  return value;
}

test("shadow differential proves zero-write closure without minting authority", () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const first = evaluateShadowDifferential(baseline(), plan, { base_dir: root });
  const second = evaluateShadowDifferential(baseline(), plan, { base_dir: root });
  assert.equal(first.verdict, "passed");
  assert.equal(first.zero_write_proven, true);
  assert.deepEqual(first.mandatory_closure.missing_step_ids, []);
  assert.deepEqual(first.effect_analysis.unknown_effects, []);
  assert.equal(first.activation_allowed, false);
  assert.equal(first.canonical_write_allowed, false);
  assert.equal(first.digest, second.digest);
});

test("shadow differential blocks missing mandatory steps and scope expansion", () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const required = baseline({
    mandatory_steps: [{ id: "step.missing", operation: "operation.absent", required_effects: [], rollback_required: false }],
    allowed_scope: { component_instances: ["worker.prepare"], operations: [], capabilities: [], effects: [] }
  });
  const result = evaluateShadowDifferential(required, plan, { base_dir: root });
  assert.equal(result.verdict, "blocked");
  assert(result.blockers.includes("mandatory_step_missing:step.missing"));
  assert(result.blockers.includes("scope_component_unexpected:worker.review"));
  assert(result.blockers.includes("scope_operation_unexpected:operation.execute"));
  assert(result.blockers.includes("scope_capability_unexpected:pure"));
});

test("shadow differential requires rollback coverage for declared effectful steps", () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const required = baseline({
    mandatory_steps: [{ id: "step.prepare", operation: "operation.execute", component_instance: "worker.prepare", required_effects: ["workspace_patch"], rollback_required: true }]
  });
  const result = evaluateShadowDifferential(required, plan, { base_dir: root });
  assert.equal(result.verdict, "blocked");
  assert(result.blockers.includes("rollback_coverage_missing:step.prepare"));
});

test("shadow differential rejects tampered accepted baseline", () => {
  const plan = resolveActivationPlan(snapshot, signal);
  const accepted = baseline();
  accepted.allowed_scope.operations = [];
  assert.throws(() => evaluateShadowDifferential(accepted, plan, { base_dir: root }), /shadow_baseline_digest_mismatch/);
});
