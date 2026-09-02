const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { planAutonomicCycle } = require("../../dist/cjs/evolution");

test("bounded autonomic reconcile is deterministic and proposal-first", () => {
  const fixture = path.resolve(__dirname, "../../examples/mirai-autonomic-fabric-minimal/results/autonomic-cycle-input.json");
  const input = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const first = planAutonomicCycle(input);
  const second = planAutonomicCycle(input);
  assert.equal(first.digest, second.digest);
  assert.equal(first.canonical_write_allowed, false);
  assert.equal(first.processes.intended_count, 1);
  assert.equal(first.processes.observed_count, 1);
  assert.equal(first.processes.candidates.find((item) => item.mode === "observed").technology_draft_allowed, false);
  assert.equal(first.evolution_proposal.changes.every((item) => item.stratum === "adaptive_canonical"), true);
});
