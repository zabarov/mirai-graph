const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { compileProgramFile } = require("../../dist/cjs/program");
const { executePure, replayPure } = require("../../dist/cjs/runtime");
const { createOutcomeAdmissionVerifier, createOutcomePureAdapters, outcomeOperationCatalog } = require("../../dist/cjs/outcome");

const root = path.resolve(__dirname, "../../examples/mirai-outcome-completion-minimal");
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

test("existing Mirai Program composes outcome operations without new node kinds", async () => {
  const program = compileProgramFile(path.join(root, "program.mirai.yaml")).program;
  const evidence = load("evidence-set.json");
  const verifyAdmission = createOutcomeAdmissionVerifier(evidence.policy_digest, evidence.digest, evidence.items.map((item) => item.admission_receipt_digest));
  const adapters = createOutcomePureAdapters(outcomeOperationCatalog().digest, verifyAdmission);
  const episode = await executePure(program, { contract: load("outcome-contract.json"), candidates: load("candidate-set.json"), evidence }, { adapters });
  assert.equal(episode.outputs.delivery.status, "satisfied");
  assert.equal(episode.effects_executed, false);
  assert.equal(episode.outputs.delivery.assessment_digest, episode.final_state.assessment.digest);
  const replay = await replayPure(episode, program, { adapters });
  assert.equal(replay.status, "match");
});
