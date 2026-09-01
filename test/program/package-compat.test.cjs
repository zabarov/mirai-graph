const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

test("CommonJS subpath exports expose the alpha contracts", () => {
  const root = require("../../dist/cjs");
  const program = require("../../dist/cjs/program");
  assert.equal(program.PROGRAM_CONTRACT_VERSION, "1.0.0");
  assert.equal(root.runtime.runtimeAvailability().executable_effects_enabled, false);
  assert.equal(typeof root.runCli, "function");
});

test("compatibility wrapper keeps the 1.4 Project Technology API", () => {
  const legacy = require(path.resolve(__dirname, "../../packages/project-technology"));
  assert.equal(typeof legacy, "object");
  assert(Object.keys(legacy).length > 0);
});
