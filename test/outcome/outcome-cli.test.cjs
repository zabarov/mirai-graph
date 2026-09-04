const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repo = path.resolve(__dirname, "../..");
const cli = path.join(repo, "packages/cli/mirai.js");
const fixture = (...parts) => path.join(repo, "examples/mirai-outcome-completion-minimal", ...parts);
const { digestValue } = require("../../dist/cjs/core");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-outcome-cli-"));
const evidence = JSON.parse(fs.readFileSync(fixture("evidence-set.json"), "utf8"));
const registryBody = { policy_digest: evidence.policy_digest, evidence_sets: { [evidence.digest]: evidence.items.map((item) => item.admission_receipt_digest) } };
fs.writeFileSync(path.join(home, "outcome-admissions.json"), `${JSON.stringify({ ...registryBody, digest: digestValue(registryBody) }, null, 2)}\n`);
const run = (args) => spawnSync(process.execPath, [cli, ...args, "--home", home], { cwd: repo, encoding: "utf8" });

test("outcome CLI validates, assesses and explains", () => {
  const validation = run(["outcome", "validate", fixture("outcome-contract.json")]);
  assert.equal(validation.status, 0, validation.stderr); assert.equal(JSON.parse(validation.stdout).valid, true);
  const assessed = run(["outcome", "assess", "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json")]);
  assert.equal(assessed.status, 0, assessed.stderr); assert.equal(JSON.parse(assessed.stdout).status, "satisfied");
  const explained = run(["outcome", "explain", fixture("assessment.json"), "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json"), "--markdown"]);
  assert.equal(explained.status, 0, explained.stderr); assert.match(explained.stdout, /No execution, approval, capability or canonical write/);
});
