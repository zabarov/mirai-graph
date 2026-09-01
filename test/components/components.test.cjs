const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { relationApplies, validateComponentPackage, validateRelationFact } = require("../../dist/cjs/components");

const fixture = path.resolve(__dirname, "../../examples/mirai-components-minimal/component-package.json");

test("component interfaces and explicit bindings validate", () => {
  const pkg = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.deepEqual(validateComponentPackage(pkg), { valid: true, errors: [], warnings: [] });
});

test("equal-priority contextual bindings fail closed", () => {
  const pkg = JSON.parse(fs.readFileSync(fixture, "utf8"));
  pkg.contextual_bindings.push({ ...pkg.contextual_bindings[0], id: "binding.duplicate" });
  const result = validateComponentPackage(pkg);
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((item) => item.startsWith("ambiguous_dispatch:")), true);
});

test("multidimensional relation facts honor time, scope and conditions", () => {
  const fact = {
    contract_version: "1.0.0", id: "relation.demo", type: "governed_work",
    participants: [{ ref: "worker", role: "actor" }, { ref: "policy", role: "governing_policy" }, { ref: "department", role: "scope_owner" }],
    scope: "demo", conditions: { risk: "normal" }, valid_from: "2026-01-01T00:00:00Z", valid_until: "2027-01-01T00:00:00Z",
    priority: 10, authority: "owner_asserted", confidence: 1, provenance: [{ source_ref: "source.demo" }]
  };
  assert.equal(validateRelationFact(fact).valid, true);
  assert.equal(relationApplies(fact, { now: "2026-06-01T00:00:00Z", scope: "demo", values: { risk: "normal" } }), true);
  assert.equal(relationApplies(fact, { now: "2028-06-01T00:00:00Z", scope: "demo", values: { risk: "normal" } }), false);
  assert.equal(relationApplies(fact, { now: "2026-06-01T00:00:00Z", scope: "other", values: { risk: "normal" } }), false);
});
