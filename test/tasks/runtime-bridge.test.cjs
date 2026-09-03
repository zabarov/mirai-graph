const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const { digestValue } = require("../../dist/cjs/core");
const { compileProgramSource, validateProgram, programDigest } = require("../../dist/cjs/program");
const { standardOperationCatalogDigest, projectAccessibleSnapshot } = require("../../dist/cjs/stdlib");
const { createTaskPolicy, prepareTaskPlan, createTaskRuntimeAdapters, taskRuntimeRegistryDigest, taskOperationResource, TASK_OPERATIONS } = require("../../dist/cjs/tasks");
const { RunStore, startGovernedRun, resumeGovernedRun, createApprovalReceipt, policyDigest, executePure, buildSanitizedEvidence, replayGovernedEpisode } = require("../../dist/cjs/runtime");
const { snapshot, oracle } = require("../fixtures/graph-organization.cjs");
const record = { kind: "record", fields: { value: "string" } };
const literal = value => ({ op: "literal", value });

function setup(t, options = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-bridge-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sandbox = path.join(root, "sandbox"); fs.mkdirSync(sandbox);
  const store = new RunStore(path.join(root, "home"));
  const graph = projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
  const policy = createTaskPolicy({ id: "policy.tasks", owner: "owner", reviewers: ["reviewer"],
    participants: ["owner", "worker"].map(id => ({ id, object_ids: oracle.accessible, source_ids: ["source.shared"], delegate_to: ["worker"] })),
    max_depth: 1, max_tasks: 8, max_parallel: 2, max_duration_ms: 10000, max_output_bytes: 10000, max_model_calls: 1 });
  const calls = [];
  const receivers = [{ id: "worker", kind: "ai", digest: digestValue("mock.worker"), input_type: record, output_type: record,
    async execute(input, context) { calls.push(context.idempotency_key); if (options.execute) return options.execute(input, context);
      return { output: input, evidence: [{ id: "evidence.done", digest: digestValue(input) }] }; } }];
  const request = { id: "task.one", parent_id: null, receiver_id: "worker", receiver_digest: receivers[0].digest, object_ids: ["requirements.a"],
    input: { value: "requested" }, dependencies: [], required_evidence: ["evidence.done"], deadline: new Date(Date.now() + 60000).toISOString(), outcome: "Return the input with evidence" };
  const plan = prepareTaskPlan("plan.fixed", graph, policy, [request], receivers);
  const registry = { graph, policy, receivers, plans: [plan] }; const registryDigest = taskRuntimeRegistryDigest(registry);
  const args = { registry_digest: registryDigest, plan_digest: plan.digest };
  const capPolicy = { contract_version: "1.0.0", grant_ttl_ms: 60000, max_calls_per_grant: 1,
    rules: Object.entries(TASK_OPERATIONS).map(([op, def]) => ({ id: `cap.${op}`, adapters: ["mirai_tasks"], operations: [op], effects: [def.effect], resource_prefixes: [`mirai-task:${registryDigest}`], approval_required: false })) };
  function program(operations = ["submit", "inference", "collect"]) {
    return compileProgramSource(JSON.stringify({ contract_version: "1.1.0", id: "program.tasks", version: "1.0.0", entry: "step.0",
      operation_catalog: { id: "mirai.stdlib", contract_version: "1.0.0", digest: standardOperationCatalogDigest() },
      nodes: [...operations.map((op, i) => ({ id: `step.${i}`, kind: "call", target: { kind: "adapter", adapter: "mirai_tasks", operation: op },
        args: Object.fromEntries(Object.entries({ ...args, ...(["dispatch", "inference"].includes(op) ? { task_id: request.id } : {}),
          ...(op === "accept" ? { task_id: request.id, reviewer: "reviewer", verdict: "accepted", result_digest: digestValue({ output: request.input, evidence: [{ id: "evidence.done", digest: digestValue(request.input) }] }) } : {})
        }).map(([k, v]) => [k, literal(v)])),
        effects: [TASK_OPERATIONS[op].effect], capability: `cap.${op}`, next: i === operations.length - 1 ? "done" : `step.${i + 1}` })),
        { id: "done", kind: "return", values: {} }],
      policies: { budgets: { max_steps: 16, max_depth: 4, max_iterations: 4, max_parallel: 2, max_duration_ms: 10000 }, allowed_effects: [...new Set(operations.map(op => TASK_OPERATIONS[op].effect))], canonical_write_allowed: false }
    }), "tasks.mirai.json").program;
  }
  function approval(subject, runId, overrides = {}) {
    const scopes = subject.nodes.filter(n => n.kind === "call").map(n => {
      const values = Object.fromEntries(Object.entries(n.args).map(([k, v]) => [k, v.value]));
      return { run_id: runId, program_digest: subject.digest, input_digest: digestValue({}), args_digest: digestValue(values), node_id: n.id,
        adapter: "mirai_tasks", action: n.target.operation, resource: taskOperationResource(n.target.operation, values), effects: n.effects, capability: n.capability,
        budget: { max_calls: 1, max_bytes: 1000000, timeout_ms: 30000 }, policy_digest: policyDigest(capPolicy) };
    });
    return createApprovalReceipt({ home: store.home, sandbox, run_id: runId, program_digest: subject.digest, input_digest: digestValue({}),
      policy_digest: policyDigest(capPolicy), effects: [...new Set(scopes.flatMap(s => s.effects))], request_scopes: scopes, approver: "owner", ...overrides });
  }
  return { root, store, sandbox, registry, args, capPolicy, calls, program, approval, adapters: createTaskRuntimeAdapters(registry) };
}

test("Program task effects use signed scopes, versioned receipts, deduplication and effect-stub replay", async t => {
  const x = setup(t); const p = x.program(); const id = "run.bridge";
  const approval = x.approval(p, id);
  assert.equal(approval.contract_version, "1.2.0");
  const result = await startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, run_id: id, policy: x.capPolicy, apply: true, approval, adapters: x.adapters });
  assert.equal(result.run.status, "completed"); assert.equal(x.calls.length, 1);
  const receipts = x.store.listReceipts(id);
  assert.equal(receipts.length, 3);
  assert.equal(receipts.every(r => r.status === "verified" && r.contract_version === "1.1.0"), true);
  const ajv = new Ajv({ strict: false }); addFormats(ajv);
  for (const [schema, values, legacy] of [
    ["approval-receipt", [approval], "1.1.0"],
    ["effect-receipt", receipts, "1.0.0"],
    ...[["capability-request", "capability-requests"], ["capability-grant", "capabilities"]].map(([schema, folder]) =>
      [schema, fs.readdirSync(path.join(x.store.directory(id), folder)).map(f => JSON.parse(fs.readFileSync(path.join(x.store.directory(id), folder, f), "utf8"))), "1.1.0"])
  ]) {
    const validate = ajv.compile(require(`../../schemas/mirai-${schema}.schema.json`));
    for (const value of values) {
      assert.equal(validate(value), true, `${schema}: ${JSON.stringify(validate.errors)}`);
      assert.equal(validate({ ...value, contract_version: legacy }), false, "task effects cannot use a legacy contract label");
    }
  }
  assert.equal(receipts.find(r => r.operation === "collect").result.value.status, "incomplete", "execution is not acceptance");
  await resumeGovernedRun(id, { store: x.store, adapters: createTaskRuntimeAdapters(x.registry) });
  assert.equal(x.calls.length, 1);
  const replay = await replayGovernedEpisode(result.episode, p);
  assert.equal(replay.status, "match");
  assert.equal(x.calls.length, 1);
  const exported = JSON.stringify(buildSanitizedEvidence(id, x.store));
  assert.equal(exported.includes("opaque_token"), false); assert.equal(exported.includes(x.root), false);
});

test("missing approval cannot be waived by a host capability rule", async t => {
  const x = setup(t); const p = x.program();
  await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true, adapters: x.adapters }), /approval_receipt_required/);
  assert.equal(x.calls.length, 0);
});

test("one Runtime registry cannot multiply the root model-call budget by installing extra plans", t => {
  const x = setup(t);
  assert.throws(() => createTaskRuntimeAdapters({ ...x.registry, plans: [...x.registry.plans, ...x.registry.plans] }), /one_budget_root/);
});

test("pure and legacy Programs cannot execute task effects", async t => {
  const x = setup(t); const p = x.program();
  await assert.rejects(executePure(p, {}), e => e.code === "non_pure_effect_forbidden");
  const old = { ...p, contract_version: "1.0.0" }; delete old.operation_catalog; old.digest = programDigest(old);
  assert.equal(validateProgram(old).valid, false);
  const lie = structuredClone(p); lie.nodes[1].effects = ["pure"]; lie.digest = programDigest(lie);
  assert.equal(validateProgram(lie).valid, false);
});

test("AI dispatch cannot masquerade as a Program task", async t => {
  const x = setup(t); const p = x.program(["submit", "dispatch"]); const id = "run.wrong-kind";
  await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true,
    approval: x.approval(p, id), adapters: x.adapters }), /task_receiver_kind_mismatch/);
  assert.equal(x.calls.length, 0);
});

test("wrong owner and changed material fail before task provider invocation", async t => {
  for (const changed of ["owner", "args"]) {
    const x = setup(t); const p = x.program(); const id = `run.changed-${changed}`;
    const approval = x.approval(p, id, changed === "owner" ? { approver: "intruder" } : {});
    if (changed === "args") { p.nodes[1].args.task_id.value = "task.other"; p.digest = programDigest(p); }
    await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true, approval, adapters: x.adapters }), /approval/);
    assert.equal(x.calls.length, 0);
  }
});

test("restart after adapter outcome does not resubmit the task or invoke inference twice", async t => {
  const x = setup(t); const p = x.program(); const id = "run.crash";
  await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true,
    approval: x.approval(p, id), adapters: x.adapters, fault_injection: "after_execute_before_verify" }), /fault_injected/);
  await resumeGovernedRun(id, { store: x.store, adapters: createTaskRuntimeAdapters(x.registry) });
  assert.equal(x.calls.length, 1);
});

test("uncertain inference blocks retry and completion", async t => {
  const x = setup(t, { execute: async () => { throw new Error("provider_lost_response"); } });
  const p = x.program(); const id = "run.uncertain-inference";
  await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true,
    approval: x.approval(p, id), adapters: x.adapters }), /effect_uncertain/);
  await assert.rejects(resumeGovernedRun(id, { store: x.store, adapters: createTaskRuntimeAdapters(x.registry) }), /reconciliation/);
  assert.equal(x.calls.length, 1); assert.notEqual(x.store.readRun(id).status, "completed");
});

test("the same plan in two parent runs has distinct provider idempotency keys", async t => {
  const x = setup(t); const p = x.program();
  for (const id of ["run.first", "run.second"]) await startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true,
    approval: x.approval(p, id), adapters: x.adapters });
  assert.equal(x.calls.length, 2); assert.equal(new Set(x.calls).size, 2);
});

test("acceptance waits for an independent exact-result approval and resumes without rerunning work", async t => {
  const x = setup(t); const p = x.program(["submit", "inference", "accept", "collect"]); const id = "run.review";
  await assert.rejects(startGovernedRun(p, {}, { store: x.store, sandbox: x.sandbox, policy: x.capPolicy, apply: true,
    approval: x.approval(p, id), adapters: x.adapters }), /task_runtime_owner_approval_required/);
  assert.equal(x.calls.length, 1);
  assert.equal(x.store.listReceipts(id).some(r => r.operation === "accept"), false, "authorization failure is before effect preparation");
  const result = await resumeGovernedRun(id, { store: x.store, adapters: x.adapters, approval: x.approval(p, id, { approver: "reviewer" }) });
  assert.equal(result.run.status, "completed"); assert.equal(x.calls.length, 1);
  assert.equal(x.store.listReceipts(id).find(r => r.operation === "collect").result.value.status, "accepted");
});

test("nested governed Program requires the exact child approval and preserves import binding on replay", async t => {
  const x = setup(t); const child = x.program(); const id = "run.nested-tasks";
  const parent = compileProgramSource(JSON.stringify({ contract_version: "1.1.0", id: "program.parent", version: "1.0.0", entry: "delegate",
    operation_catalog: { id: "mirai.stdlib", contract_version: "1.0.0", digest: standardOperationCatalogDigest() },
    imports: [{ alias: "child", ref: child.id, digest: child.digest }],
    nodes: [{ id: "delegate", kind: "call", target: { kind: "program", program: "child" }, args: {}, next: "done" },
      { id: "done", kind: "return", values: {} }],
    policies: { budgets: { max_steps: 24, max_depth: 4, max_iterations: 4, max_parallel: 2, max_duration_ms: 10000 }, allowed_effects: child.policies.allowed_effects, canonical_write_allowed: false }
  }), "parent.mirai.json").program;
  await assert.rejects(startGovernedRun(parent, {}, { store: x.store, sandbox: x.sandbox, run_id: id, policy: x.capPolicy,
    apply: true, programs: { child }, adapters: x.adapters }), /approval_receipt_required/);
  assert.equal(x.calls.length, 0);
  const result = await resumeGovernedRun(id, { store: x.store, adapters: x.adapters, approval: x.approval(child, id) });
  assert.equal(result.run.status, "completed"); assert.equal(x.calls.length, 1);
  assert.equal(x.store.listReceipts(id).every(r => r.program_digest === child.digest), true);
  const replay = await replayGovernedEpisode(result.episode, parent, { programs: { child } });
  assert.equal(replay.status, "match"); assert.equal(x.calls.length, 1);
  const substituted = structuredClone(child); substituted.version = "1.0.1"; substituted.digest = programDigest(substituted);
  await assert.rejects(replayGovernedEpisode(result.episode, parent, { programs: { child: substituted } }), e => e.code === "import_digest_mismatch");
});
