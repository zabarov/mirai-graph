const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { programDigest } = require("../../dist/cjs/program");
const { compileProgramFile } = require("../../dist/cjs/program");
const { executePure, replayPure, PureExecutionError } = require("../../dist/cjs/runtime");

function program(id, nodes, options = {}) {
  const value = {
    contract_version: "1.0.0",
    id,
    version: "1.0.0",
    imports: options.imports || [],
    inputs: options.inputs || [],
    outputs: options.outputs || [],
    state: options.state || [],
    nodes,
    entry: options.entry || nodes[0].id,
    error_routes: options.error_routes || [],
    policies: {
      budgets: { max_steps: 256, max_depth: 16, max_iterations: 64, max_parallel: 8, max_duration_ms: 30000 },
      allowed_effects: options.allowed_effects || ["pure"],
      canonical_write_allowed: false
    },
    source_map: Object.fromEntries(nodes.map((node) => [node.id, { file: "test:generated" }]))
  };
  return { ...value, digest: programDigest(value) };
}

test("100 pure runs have identical outputs and trace digests", async () => {
  const fixture = compileProgramFile(path.resolve(__dirname, "../../examples/mirai-program-minimal/program.mirai.yaml")).program;
  const episodes = [];
  for (let index = 0; index < 100; index += 1) episodes.push(await executePure(fixture, { approved: true }));
  assert.equal(new Set(episodes.map((item) => item.trace_digest)).size, 1);
  assert.equal(new Set(episodes.map((item) => item.output_digest)).size, 1);
  assert.deepEqual(episodes[0].outputs, { decision: "accepted" });
  const replay = await replayPure(episodes[0], fixture);
  assert.equal(replay.status, "match");
});

test("call, match, emit and return are deterministic", async () => {
  const subject = program("program.operations", [
    {
      id: "sum", kind: "call", target: { kind: "adapter", adapter: "pure", operation: "add_int64" },
      args: { left: { op: "ref", path: "input.left" }, right: { op: "ref", path: "input.right" } },
      result: "total", effects: ["pure"], next: "classify"
    },
    {
      id: "classify", kind: "match", value: { op: "ref", path: "state.total" },
      cases: [{ equals: 5, to: "emit" }], default: "other"
    },
    { id: "emit", kind: "emit", event: "sum.five", payload: { op: "ref", path: "state.total" }, next: "done" },
    { id: "other", kind: "return", values: { status: { op: "literal", value: "other" }, total: { op: "ref", path: "state.total" } } },
    { id: "done", kind: "return", values: { status: { op: "literal", value: "five" }, total: { op: "ref", path: "state.total" } } }
  ], {
    inputs: [{ id: "left", type: "int64" }, { id: "right", type: "int64" }],
    outputs: [{ id: "status", type: "string" }, { id: "total", type: "int64" }],
    state: [{ id: "total", type: "int64", default: 0 }]
  });
  const episode = await executePure(subject, { left: 2, right: 3 });
  assert.deepEqual(episode.outputs, { status: "five", total: 5 });
  assert.deepEqual(episode.emitted_events, [{ event: "sum.five", payload: 5 }]);
});

test("foreach and parallel isolate child state and merge in declaration order", async () => {
  const worker = program("program.worker", [
    { id: "return", kind: "return", values: { value: { op: "ref", path: "input.item" } } }
  ], {
    inputs: [{ id: "item", type: "string" }],
    outputs: [{ id: "value", type: "string" }]
  });
  const recordType = { kind: "record", fields: { value: "string" } };
  const parent = program("program.parent", [
    {
      id: "each", kind: "foreach", items: { op: "ref", path: "input.items" }, item: "item",
      program: "worker", max_iterations: 8, result: "each_results", next: "parallel"
    },
    {
      id: "parallel", kind: "parallel", branches: [
        { id: "second", program: "worker", input: { item: { op: "literal", value: "B" } } },
        { id: "first", program: "worker", input: { item: { op: "literal", value: "A" } } }
      ], max_parallel: 2, merge: "object", result: "parallel_results", next: "return"
    },
    {
      id: "return", kind: "return", values: {
        each_results: { op: "ref", path: "state.each_results" },
        parallel_results: { op: "ref", path: "state.parallel_results" }
      }
    }
  ], {
    imports: [{ alias: "worker", ref: "program.worker", digest: worker.digest }],
    inputs: [{ id: "items", type: { kind: "list", items: "string" } }],
    outputs: [
      { id: "each_results", type: { kind: "list", items: recordType } },
      { id: "parallel_results", type: { kind: "map", values: recordType } }
    ],
    state: [
      { id: "each_results", type: { kind: "list", items: recordType }, default: [] },
      { id: "parallel_results", type: { kind: "map", values: recordType }, default: {} }
    ]
  });
  const episode = await executePure(parent, { items: ["x", "y"] }, { programs: { worker } });
  assert.deepEqual(episode.outputs.each_results, [{ value: "x" }, { value: "y" }]);
  assert.deepEqual(Object.keys(episode.outputs.parallel_results), ["second", "first"]);
});

test("await follows supplied event or deterministic timeout route", async () => {
  const subject = program("program.await", [
    { id: "wait", kind: "await", event: "review.completed", deadline_ms: 100, result: "review", next: "received", on_timeout: "timeout" },
    { id: "received", kind: "return", values: { status: { op: "ref", path: "state.review" } } },
    { id: "timeout", kind: "return", values: { status: { op: "literal", value: "timeout" } } }
  ], {
    outputs: [{ id: "status", type: "string" }],
    state: [{ id: "review", type: "string", default: "pending" }]
  });
  assert.deepEqual((await executePure(subject, {}, { events: { "review.completed": "accepted" } })).outputs, { status: "accepted" });
  assert.deepEqual((await executePure(subject, {})).outputs, { status: "timeout" });
});

test("retry exhausts deterministically and cancel remains terminal", async () => {
  const failing = program("program.failing", [
    {
      id: "fail", kind: "call", target: { kind: "adapter", adapter: "pure", operation: "fail" },
      args: { code: { op: "literal", value: "expected_failure" } }, effects: ["pure"], next: "done"
    },
    { id: "done", kind: "return" }
  ]);
  const retry = program("program.retry", [
    { id: "retry", kind: "retry", program: "failing", max_attempts: 3, backoff_ms: 0, timeout_ms: 10, on_error: "failed", next: "unexpected" },
    { id: "failed", kind: "return", values: { status: { op: "literal", value: "failed" } } },
    { id: "unexpected", kind: "return", values: { status: { op: "literal", value: "unexpected" } } }
  ], {
    imports: [{ alias: "failing", ref: failing.id, digest: failing.digest }],
    outputs: [{ id: "status", type: "string" }]
  });
  const episode = await executePure(retry, {}, { programs: { failing } });
  assert.deepEqual(episode.outputs, { status: "failed" });
  assert.equal(episode.trace.filter((item) => item.decision.startsWith("failed_attempt")).length, 3);

  const cancel = program("program.cancel", [
    { id: "cancel", kind: "cancel", reason: { op: "literal", value: "operator_request" } }
  ]);
  assert.equal((await executePure(cancel, {})).status, "cancelled");
});

test("program call, timeout and pure compensation follow explicit routes", async () => {
  const child = program("program.child", [
    { id: "emit.one", kind: "emit", event: "child.one", next: "emit.two" },
    { id: "emit.two", kind: "emit", event: "child.two", next: "return" },
    { id: "return", kind: "return", values: { value: { op: "ref", path: "input.value" } } }
  ], {
    inputs: [{ id: "value", type: "string" }],
    outputs: [{ id: "value", type: "string" }]
  });
  const parent = program("program.call-timeout", [
    {
      id: "call", kind: "call", target: { kind: "program", program: "child" },
      args: { value: { op: "literal", value: "ok" } }, result: "called", next: "timeout"
    },
    {
      id: "timeout", kind: "timeout", program: "child", input: { value: { op: "literal", value: "slow" } },
      timeout_ms: 1, result: "timed", on_timeout: "compensate", next: "unexpected"
    },
    { id: "compensate", kind: "compensate", receipt: { op: "literal", value: "receipt.synthetic" }, next: "return" },
    { id: "unexpected", kind: "return", values: { status: { op: "literal", value: "unexpected" } } },
    { id: "return", kind: "return", values: { status: { op: "get", target: { op: "ref", path: "state.called" }, key: "value" } } }
  ], {
    imports: [{ alias: "child", ref: child.id, digest: child.digest }],
    outputs: [{ id: "status", type: "string" }],
    state: [
      { id: "called", type: { kind: "record", fields: { value: "string" } }, default: { value: "pending" } },
      { id: "timed", type: { kind: "record", fields: { value: "string" } }, default: { value: "pending" } }
    ]
  });
  const episode = await executePure(parent, {}, { programs: { child } });
  assert.deepEqual(episode.outputs, { status: "ok" });
  assert(episode.trace.some((item) => item.node_id === "timeout" && item.decision.startsWith("timed_out:")));
  assert(episode.trace.some((item) => item.node_id === "compensate" && item.decision === "pure_compensation_recorded"));
});

test("pure interpreter rejects non-pure policies before adapter execution", async () => {
  const unsafe = program("program.unsafe", [
    {
      id: "read", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read" },
      effects: ["repository_read"], capability: "capability.read", next: "done"
    },
    { id: "done", kind: "return" }
  ], { allowed_effects: ["repository_read"] });
  await assert.rejects(() => executePure(unsafe, {}), (error) => error instanceof PureExecutionError && error.code === "non_pure_effect_forbidden");
});

test("logical duration budget fails closed", async () => {
  const subject = program("program.duration-budget", [
    { id: "emit.one", kind: "emit", event: "one", next: "emit.two" },
    { id: "emit.two", kind: "emit", event: "two", next: "return" },
    { id: "return", kind: "return" }
  ]);
  subject.policies.budgets.max_duration_ms = 2;
  subject.digest = programDigest(subject);
  await assert.rejects(
    () => executePure(subject, {}),
    (error) => error instanceof PureExecutionError && error.code === "duration_budget_exceeded"
  );
});

test("retry timeout is enforced per attempt", async () => {
  const slow = program("program.retry-slow", [
    { id: "emit.one", kind: "emit", event: "one", next: "emit.two" },
    { id: "emit.two", kind: "emit", event: "two", next: "return" },
    { id: "return", kind: "return" }
  ]);
  const subject = program("program.retry-timeout", [
    {
      id: "retry", kind: "retry", program: "slow", max_attempts: 2,
      backoff_ms: 0, timeout_ms: 1, on_error: "timed-out", next: "unexpected"
    },
    { id: "timed-out", kind: "return", values: { status: { op: "literal", value: "timed_out" } } },
    { id: "unexpected", kind: "return", values: { status: { op: "literal", value: "unexpected" } } }
  ], {
    imports: [{ alias: "slow", ref: slow.id, digest: slow.digest }],
    outputs: [{ id: "status", type: "string" }]
  });
  const episode = await executePure(subject, {}, { programs: { slow } });
  assert.deepEqual(episode.outputs, { status: "timed_out" });
  assert.equal(episode.trace.filter((item) => item.decision === "failed_attempt:1" || item.decision === "failed_attempt:2").length, 2);
});
