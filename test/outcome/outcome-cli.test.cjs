const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repo = path.resolve(__dirname, "../..");
const cli = path.join(repo, "packages/cli/mirai.js");
const fixture = (...parts) => path.join(repo, "examples/mirai-outcome-completion-minimal", ...parts);
const run = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8" });

test("outcome CLI validates, assesses and explains", () => {
  const validation = run(["outcome", "validate", fixture("outcome-contract.json")]);
  assert.equal(validation.status, 0, validation.stderr); assert.equal(JSON.parse(validation.stdout).valid, true);
  const assessed = run(["outcome", "assess", "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json")]);
  assert.equal(assessed.status, 0, assessed.stderr); assert.equal(JSON.parse(assessed.stdout).status, "satisfied");
  const explained = run(["outcome", "explain", fixture("assessment.json"), "--markdown"]);
  assert.equal(explained.status, 0, explained.stderr); assert.match(explained.stdout, /No execution, approval, capability or canonical write/);
});
