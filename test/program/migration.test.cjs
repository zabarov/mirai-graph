const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { migrateTechnologyTarget } = require("../../dist/cjs/program");

const root = path.resolve(__dirname, "../../examples/mirai-program-migration-minimal");

test("migration without explicit bindings is blocked", () => {
  const result = migrateTechnologyTarget(path.join(root, "technology.json"));
  assert.equal(result.status, "blocked");
  assert.equal(result.candidate_program, null);
  assert(result.blockers.includes("bindings_required"));
  assert.equal(result.canonical_write_allowed, false);
});

test("explicit migration is deterministic and remains proposal-only", () => {
  const technology = path.join(root, "technology.json");
  const bindings = path.join(root, "bindings.json");
  const first = migrateTechnologyTarget(technology, bindings);
  const second = migrateTechnologyTarget(technology, bindings);
  assert.equal(first.status, "ready");
  assert.equal(first.candidate_program.digest, second.candidate_program.digest);
  assert.deepEqual(first.candidate_program.nodes.map((node) => node.id), [
    "operation.inspect", "operation.decide", "migration.return"
  ]);
  assert.equal(first.canonical_write_allowed, false);
});
