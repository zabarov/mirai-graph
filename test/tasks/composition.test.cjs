const test = require("node:test");
const assert = require("node:assert/strict");
const { compileProgramSource, programDigest } = require("../../dist/cjs/program");
const { digestValue } = require("../../dist/cjs/core");
const { programTaskReceiver } = require("../../dist/cjs/tasks");
const literal = value => ({ op: "literal", value });
const compile = source => compileProgramSource(JSON.stringify(source), "synthetic.mirai.json").program;
const budgets = { max_steps: 20, max_depth: 4, max_iterations: 4, max_parallel: 2, max_duration_ms: 1000 };
function leaf(id = "program.leaf", offset = 2) {
  return compile({ id, version: "1.0.0", entry: "compute", inputs: [{ id: "value", type: "int64" }], outputs: [{ id: "value", type: "int64" }],
    state: [{ id: "sum", type: "int64", default: 0 }],
    nodes: [{ id: "compute", kind: "call", target: { kind: "adapter", adapter: "pure", operation: "add_int64" }, effects: ["pure"],
      args: { left: { op: "ref", path: "input.value" }, right: literal(offset) }, result: "sum", next: "done" },
      { id: "done", kind: "return", values: { value: { op: "ref", path: "state.sum" } } }],
    policies: { budgets, allowed_effects: ["pure"], canonical_write_allowed: false } });
}
function parent(child, id = "program.parent", alias = "worker", ownBudgets = budgets) {
  return compile({ id, version: "1.0.0", entry: "call", imports: [{ alias, ref: child.id, digest: child.digest }],
    inputs: [{ id: "value", type: "int64" }], outputs: [{ id: "value", type: "int64" }],
    state: [{ id: "answer", type: { kind: "record", fields: { value: "int64" } }, default: { value: 0 } }],
    nodes: [{ id: "call", kind: "call", target: { kind: "program", program: alias }, args: { value: { op: "ref", path: "input.value" } }, result: "answer", next: "done" },
      { id: "done", kind: "return", values: { value: { op: "get", target: { op: "ref", path: "state.answer" }, key: "value" } } }],
    policies: { budgets: ownBudgets, allowed_effects: ["pure"], canonical_write_allowed: false } });
}
const context = () => ({ signal: new AbortController().signal });

test("pure task closure calls nested pinned Programs with stable evidence and no mutable import rebinding", async () => {
  const child = leaf(), middle = parent(child, "program.middle"), root = parent(middle);
  const programs = { [child.id]: child, [middle.id]: middle };
  const receiver = programTaskReceiver({ id: "worker", program: root, programs, evidence_id: "evidence.result" });
  const reordered = programTaskReceiver({ id: "worker", program: root, programs: { [middle.id]: middle, [child.id]: child }, evidence_id: "evidence.result" });
  assert.equal(receiver.digest, reordered.digest);
  for (const value of [1, 3, 7]) assert.deepEqual((await receiver.execute({ value }, context())).output, { value: value + 2 });
  const original = await receiver.execute({ value: 4 }, context());
  programs[child.id] = leaf(child.id, 3);
  assert.deepEqual(await receiver.execute({ value: 4 }, context()), original);
  const changedMiddle = parent(programs[child.id], middle.id), changedRoot = parent(changedMiddle);
  const changed = programTaskReceiver({ id: "worker", program: changedRoot, programs: { [child.id]: programs[child.id], [middle.id]: changedMiddle }, evidence_id: "evidence.result" });
  assert.notEqual(changed.digest, receiver.digest);
  assert.deepEqual((await changed.execute({ value: 4 }, context())).output, { value: 7 });
});

test("missing, unpinned, unused, effectful and conflicting imports fail before execution", () => {
  const child = leaf(), root = parent(child), options = { id: "worker", program: root, evidence_id: "evidence.result" };
  assert.throws(() => programTaskReceiver(options), /import_missing_or_changed/);
  assert.throws(() => programTaskReceiver({ ...options, programs: { [child.id]: leaf(child.id, 3) } }), /import_missing_or_changed/);
  assert.throws(() => programTaskReceiver({ ...options, programs: { alias: child } }), /import_identity_invalid/);
  assert.throws(() => programTaskReceiver({ ...options, programs: { [child.id]: child, "program.unused": leaf("program.unused") } }), /import_unused/);
  const effectful = compile({ id: "program.effect", version: "1.0.0", entry: "read", nodes: [
    { id: "read", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read_file" }, args: { path: literal("note.txt") }, effects: ["repository_read"], capability: "cap.read", next: "done" },
    { id: "done", kind: "return", values: {} }], policies: { budgets, allowed_effects: ["repository_read"], canonical_write_allowed: false } });
  assert.throws(() => programTaskReceiver({ ...options, program: parent(effectful), programs: { [effectful.id]: effectful } }), /effect_not_supported/);
  const collision = leaf("worker");
  assert.throws(() => programTaskReceiver({ ...options, programs: { [child.id]: child, worker: collision } }), /alias_conflict/);
  assert.throws(() => programTaskReceiver({ ...options, program: parent(child, root.id, root.id), programs: { [child.id]: child } }), /alias_conflict/);
  const invalid = structuredClone(root); invalid.imports[0].digest = digestValue("changed"); invalid.digest = programDigest(invalid);
  assert.throws(() => programTaskReceiver({ ...options, program: invalid, programs: { [child.id]: child } }), /import_missing_or_changed/);
});

test("nested calls share the root execution budget, and cancellation is not a completed task", async () => {
  const child = leaf(), root = parent(child, "program.parent", "worker", { ...budgets, max_steps: 2 });
  const receiver = programTaskReceiver({ id: "worker", program: root, programs: { [child.id]: child }, evidence_id: "evidence.result" });
  await assert.rejects(receiver.execute({ value: 2 }, context()), e => e.code === "step_budget_exceeded");
  const cancelled = compile({ id: "program.cancel", version: "1.0.0", entry: "stop", nodes: [{ id: "stop", kind: "cancel", reason: literal("no work") }],
    policies: { budgets, allowed_effects: ["pure"], canonical_write_allowed: false } });
  const stopped = programTaskReceiver({ id: "worker", program: cancelled, evidence_id: "evidence.result" });
  await assert.rejects(stopped.execute({}, context()), /task_program_not_completed/);
});

test("mutating host setup cannot rebind evidence after the receiver digest is fixed", async () => {
  const options = { id: "worker", program: leaf(), evidence_id: "evidence.original" };
  const receiver = programTaskReceiver(options);
  options.evidence_id = "evidence.changed";
  assert.equal((await receiver.execute({ value: 1 }, context())).evidence[0].id, "evidence.original");
});
