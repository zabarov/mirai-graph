const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { compileTechnologyDraft, diagnoseTechnologyDraft, extractTechnologyFile } = require("../../dist/cjs/technology");

test("explicit technology draft compiles deterministically into Mirai Program", () => {
  const fixture = path.resolve(__dirname, "../../examples/mirai-technology-draft-minimal/technology-draft.json");
  const draft = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const first = compileTechnologyDraft(draft);
  const second = compileTechnologyDraft(draft);
  assert.equal(first.digest, second.digest);
  assert.equal(first.id, "technology.review");
  assert.equal(first.policies.canonical_write_allowed, false);
});

test("ambiguous free text remains a blocked proposal", () => {
  const fixture = path.resolve(__dirname, "../../examples/mirai-technology-draft-minimal/ambiguous-technology.md");
  const draft = extractTechnologyFile(fixture);
  assert.equal(draft.canonical_write_allowed, false);
  assert.equal(draft.diagnostics.some((item) => item.severity === "blocking"), true);
  assert.throws(() => compileTechnologyDraft(draft), /technology_draft_blocked/);
});

test("compiler refuses to flatten activation-only quorum semantics", () => {
  const fixture = path.resolve(__dirname, "../../examples/mirai-technology-draft-minimal/technology-draft.json");
  const draft = JSON.parse(fs.readFileSync(fixture, "utf8"));
  draft.steps.unshift({ id: "parallel.start", kind: "parallel", branches: [{ id: "a", program_ref: "worker" }], join: "quorum", quorum: 1, max_parallel: 1, next: "step.inspect" });
  draft.entry = "parallel.start";
  assert.equal(diagnoseTechnologyDraft(draft).some((item) => item.code === "unsupported_program_join"), true);
  assert.throws(() => compileTechnologyDraft(draft), /unsupported_program_join/);
});
