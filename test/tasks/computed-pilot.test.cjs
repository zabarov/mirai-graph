const test = require("node:test");
const assert = require("node:assert/strict");
const { runComputedPilot } = require("../../packages/cli/run-graph-computed-pilot");
test("computed pilot compares nonconstant outcomes, pinned imports, accepted dependencies and recorded AI", async () => {
  const { report } = await runComputedPilot();
  assert.equal(report.cases.length, 4);
  const routes = new Set(report.cases.flatMap(c => Object.values(c.expected).map(r => r.route)));
  assert.deepEqual([...routes].sort(), ["ordinary", "review"]);
  assert.equal(report.cases.every(c => c.schedules_match && c.network_model_calls === 0), true);
});
