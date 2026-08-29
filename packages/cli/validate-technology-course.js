#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  canonicalBytes,
  compileTechnologyCourse,
  reconcileTechnologyCourse,
  verifyTechnologyCourse,
} = require("../project-technology/technology-course");

const root = path.resolve(__dirname, "../..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "examples/executable-technology-course/technology.json"), "utf8"));

function compile(options = {}) {
  return compileTechnologyCourse(root, { technology: fixture, audience: "staff", ...options });
}

const full = compile();
assert.equal(full.status, "success");
assert.deepEqual(full.course_pack.scenario_ids, ["scenario.full_release", "scenario.recovery_preparation"]);
assert.deepEqual(full.course_pack.sections.map((item) => item.technology_node_id), [
  "operation.inventory", "operation.backup", "operation.validate", "operation.promote",
]);

const partial = compile({ scenarioIds: ["scenario.recovery_preparation"] });
assert.equal(partial.status, "success");
assert.deepEqual(partial.course_pack.sections.map((item) => item.technology_node_id), ["operation.inventory", "operation.backup"]);
assert.equal(partial.course_pack.course_pack_digest, compile({ scenarioIds: ["scenario.recovery_preparation"] }).course_pack.course_pack_digest);
assert.equal(verifyTechnologyCourse(root, { coursePack: partial.course_pack }).status, "success");
assert.equal(verifyTechnologyCourse(root, { coursePack: partial }).status, "success");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-course-"));
const technologyFile = path.join(temp, "technology.json");
fs.writeFileSync(technologyFile, canonicalBytes(fixture));
const fromFile = compileTechnologyCourse(root, { technologyFile, scenarioIds: ["scenario.recovery_preparation"], audience: "staff" });
assert.equal(fromFile.course_pack.course_pack_digest, partial.course_pack.course_pack_digest);

const editorial = JSON.parse(JSON.stringify(partial.course_pack));
editorial.sections[0].title = "Understand the current state";
const editorialResult = reconcileTechnologyCourse(root, { coursePack: partial.course_pack, projection: editorial });
assert.equal(editorialResult.status, "success");
assert.equal(editorialResult.editorial_changes.length, 1);
assert.equal(editorialResult.canonical_write_allowed, false);

const semantic = JSON.parse(JSON.stringify(partial.course_pack));
semantic.sections[1].check_refs = [];
const semanticResult = reconcileTechnologyCourse(root, { coursePack: partial.course_pack, projection: semantic });
assert.equal(semanticResult.status, "needs_decision");
assert.equal(semanticResult.semantic_proposals.length, 1);
assert.equal(semanticResult.canonical_write_allowed, false);

const stale = JSON.parse(JSON.stringify(partial.course_pack));
stale.course_pack_digest = `sha256:${"0".repeat(64)}`;
assert.equal(reconcileTechnologyCourse(root, { coursePack: partial.course_pack, projection: stale }).status, "blocked");

for (const mutate of [
  (item) => { item.operations[1].prerequisites = ["operation.unknown"]; },
  (item) => { item.operations[0].prerequisites = ["operation.backup"]; },
  (item) => { item.operations.push(JSON.parse(JSON.stringify(item.operations[0]))); },
  (item) => { item.scenarios[0].operation_ids = ["operation.unknown"]; },
]) {
  const invalid = JSON.parse(JSON.stringify(fixture)); mutate(invalid);
  assert.equal(compileTechnologyCourse(root, { technology: invalid }).status, "blocked");
}

const tampered = JSON.parse(JSON.stringify(partial.course_pack));
tampered.sections[0].summary = "Tampered";
assert.equal(verifyTechnologyCourse(root, { coursePack: tampered }).status, "blocked");

const secret = JSON.parse(JSON.stringify(partial.course_pack));
secret.sections[0].token = "forbidden";
assert.equal(verifyTechnologyCourse(root, { coursePack: secret }).status, "blocked");

assert.deepEqual(fs.readdirSync(temp).sort(), ["technology.json"]);
fs.rmSync(temp, { recursive: true, force: true });
console.log("technology course validation: PASS");
