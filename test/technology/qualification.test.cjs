const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  compileHybridTechnologyPlan,
  qualifyTechnologyDraft
} = require("../../dist/cjs/technology");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../../examples/mirai-technology-qualification-minimal");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

test("mixed technology becomes a deterministic hybrid plan without activation authority", () => {
  const draft = read("technology-draft.json");
  const qualification = qualifyTechnologyDraft(draft, read("bindings.json"));
  const repeated = qualifyTechnologyDraft(draft, read("bindings.json"));
  assert.equal(qualification.status, "hybrid_ready");
  assert.equal(qualification.digest, repeated.digest);
  assert.equal(qualification.simulation_allowed, true);
  assert.equal(qualification.activation_allowed, false);
  assert.equal(qualification.canonical_write_allowed, false);

  const plan = compileHybridTechnologyPlan(draft, qualification);
  assert.equal(plan.qualification_status, "hybrid_ready");
  assert.equal(plan.requires_human_coordination, true);
  assert.equal(plan.activation_allowed, false);
  assert.deepEqual(plan.operations.map((item) => item.mode), ["program_operation", "verification_gate", "decision_checkpoint"]);
});

test("unreviewed executable binding remains a program candidate", () => {
  const qualification = qualifyTechnologyDraft(read("technology-draft.json"), read("bindings-unreviewed.json"));
  assert.equal(qualification.status, "program_candidate");
  assert.equal(qualification.activation_allowed, false);
  assert.throws(() => compileHybridTechnologyPlan(read("technology-draft.json"), qualification), /technology_qualification_not_ready/);
});

test("missing classification and human operation effect bindings fail closed", () => {
  const draft = read("technology-draft.json");
  const missing = qualifyTechnologyDraft(draft, read("bindings.json").slice(0, 2));
  assert.equal(missing.status, "blocked");
  assert.equal(missing.blocking_diagnostics.some((item) => item.code === "operation_classification_required"), true);

  const unsafe = qualifyTechnologyDraft(draft, read("invalid-advisory-effect-bindings.json"));
  assert.equal(unsafe.status, "blocked");
  assert.equal(unsafe.blocking_diagnostics.some((item) => item.code === "human_operation_cannot_bind_effect"), true);
});

test("fully executable qualification preserves the existing Program compiler", () => {
  const draft = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-technology-draft-minimal/technology-draft.json"), "utf8"));
  const qualification = qualifyTechnologyDraft(draft, [{
    step_id: "step.inspect",
    classification: "executable",
    acceptance: "owner_accepted",
    acceptance_ref: "evidence.classification.inspect",
    reason: "Pure reference operation.",
    adapter: "pure",
    effects: ["pure"]
  }]);
  assert.equal(qualification.status, "executable_ready");
  const plan = compileHybridTechnologyPlan(draft, qualification);
  assert.equal(plan.activation_allowed, false);
  assert.match(plan.runtime_program_digest, /^sha256:/);
});

test("qualification is bound to the exact draft and digest", () => {
  const draft = read("technology-draft.json");
  const qualification = qualifyTechnologyDraft(draft, read("bindings.json"));
  assert.throws(() => compileHybridTechnologyPlan({ ...draft, goal: "changed" }, qualification), /technology_qualification_mismatch/);
  assert.throws(() => compileHybridTechnologyPlan(draft, { ...qualification, digest: "sha256:" + "0".repeat(64) }), /technology_qualification_digest_mismatch/);

  const forged = {
    ...qualification,
    operations: qualification.operations.map((item, index) => index === 0 ? { ...item, operation: "forged_operation" } : item)
  };
  const { digest: _digest, ...forgedPayload } = forged;
  forged.digest = digestValue(forgedPayload);
  assert.throws(() => compileHybridTechnologyPlan(draft, forged), /technology_qualification_semantic_mismatch/);
});
