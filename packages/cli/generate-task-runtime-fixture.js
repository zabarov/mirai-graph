#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { compileProgramSource } = require("../../dist/cjs/program");
const { buildCapabilityRequest, policyDigest } = require("../../dist/cjs/runtime");
const { standardOperationCatalogDigest } = require("../../dist/cjs/stdlib");
const { createTaskPolicy, prepareTaskPlan, programTaskReceiver, recordedTaskReceiver, taskContextView, taskRuntimeRegistryDigest, taskOperationResource, TASK_OPERATIONS } = require("../../dist/cjs/tasks");
const root = path.resolve(__dirname, "../..");
const readPortableText = target => fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
const literal = value => ({ op: "literal", value });
async function buildFixture() {
  const graph = JSON.parse(fs.readFileSync(path.join(root, "examples/mirai-graph-operations-minimal/graph.json"), "utf8"));
  const policy = createTaskPolicy({ id: "policy.task-demo", owner: "owner", reviewers: ["reviewer"],
    participants: ["owner", "worker.program", "worker.ai"].map(id => ({ id, object_ids: ["requirements.a"], source_ids: ["source.shared"], delegate_to: ["worker.program", "worker.ai"] })),
    max_depth: 2, max_tasks: 8, max_parallel: 2, max_duration_ms: 10000, max_output_bytes: 10000, max_model_calls: 1 });
  const program = compileProgramSource(JSON.stringify({ id: "program.risk-route", version: "1.0.0", entry: "classify",
    inputs: [{ id: "risk", type: "string" }], outputs: [{ id: "route", type: "string" }], nodes: [
      { id: "classify", kind: "branch", condition: { op: "eq", left: { op: "ref", path: "input.risk" }, right: literal("high") }, then: "review", else: "ordinary" },
      { id: "review", kind: "return", values: { route: literal("review") } },
      { id: "ordinary", kind: "return", values: { route: literal("ordinary") } }
    ], policies: { budgets: { max_steps: 8, max_depth: 2, max_iterations: 2, max_parallel: 2, max_duration_ms: 1000 }, allowed_effects: ["pure"], canonical_write_allowed: false }
  }), "worker.mirai.json").program;
  const worker = programTaskReceiver({ id: "worker.program", program, evidence_id: "evidence.classification" });
  const requests = [
    { id: "task.classify", parent_id: null, receiver_id: worker.id, receiver_digest: worker.digest, object_ids: ["requirements.a"], input: { risk: "high" },
      dependencies: [], required_evidence: ["evidence.classification"], deadline: "2099-01-01T00:00:00.000Z", outcome: "Classify the risk and route high risk to review" },
    { id: "task.draft", parent_id: null, receiver_id: "worker.ai", receiver_digest: digestValue("unbound"), object_ids: ["requirements.a"], input: { request: "Draft a response after risk classification" },
      dependencies: [{ task_id: "task.classify", requires: "verified" }], required_evidence: ["evidence.draft"], deadline: "2099-01-01T00:00:00.000Z", outcome: "Return a review-required draft, not acceptance" }
  ];
  const classification = await worker.execute(requests[0].input, { task_id: requests[0].id, idempotency_key: digestValue("fixture"),
    signal: new AbortController().signal, view: taskContextView(graph, policy, requests[0], requests), dependencies: {} });
  const recording = { contract_version: "1.0.0", id: "worker.ai", kind: "recorded_ai",
    input_type: { kind: "record", fields: { request: "string" } }, output_type: { kind: "record", fields: { draft: "string" } },
    recordings: [{ task_id: "task.draft", input_digest: digestValue(requests[1].input), view_digest: taskContextView(graph, policy, requests[1], requests).digest,
      dependencies_digest: digestValue({ "task.classify": classification }), result: { output: { draft: "High risk: request independent review before acceptance." }, evidence: [{ id: "evidence.draft", digest: digestValue("synthetic.draft") }] } }] };
  const recorded = recordedTaskReceiver(recording); requests[1].receiver_digest = recorded.digest;
  const plan = prepareTaskPlan("plan.task-demo", graph, policy, requests, [worker, recorded]);
  const registry = { graph, policy, plans: [plan], receivers: [worker, recorded] };
  const registryDigest = taskRuntimeRegistryDigest(registry);
  const steps = [["submit"], ["dispatch", "task.classify"], ["inference", "task.draft"], ["collect"]];
  const main = compileProgramSource(JSON.stringify({ contract_version: "1.1.0", id: "program.task-demo", version: "1.0.0", entry: "step.0",
    operation_catalog: { id: "mirai.stdlib", contract_version: "1.0.0", digest: standardOperationCatalogDigest() },
    state: [{ id: "collected", type: { kind: "record", fields: { value: { kind: "record", fields: { status: "string" } } } }, default: { value: { status: "pending" } } }],
    outputs: [{ id: "task_status", type: "string" }],
    nodes: [...steps.map(([operation, task], i) => ({ id: `step.${i}`, kind: "call", target: { kind: "adapter", adapter: "mirai_tasks", operation },
      args: Object.fromEntries(Object.entries({ registry_digest: registryDigest, plan_digest: plan.digest, ...(task ? { task_id: task } : {}) }).map(([k, v]) => [k, literal(v)])),
      effects: [TASK_OPERATIONS[operation].effect], capability: `cap.${operation}`, next: i === steps.length - 1 ? "done" : `step.${i + 1}`,
      ...(operation === "collect" ? { result: "collected" } : {}) })),
      { id: "done", kind: "return", values: { task_status: { op: "get", target: { op: "get", target: { op: "ref", path: "state.collected" }, key: "value" }, key: "status" } } }],
    policies: { budgets: { max_steps: 16, max_depth: 4, max_iterations: 8, max_parallel: 2, max_duration_ms: 10000 }, allowed_effects: [...new Set(steps.map(([op]) => TASK_OPERATIONS[op].effect))], canonical_write_allowed: false }
  }), "main.mirai.json").program;
  const capabilityPolicy = { contract_version: "1.0.0", grant_ttl_ms: 60000, max_calls_per_grant: 1,
    rules: steps.map(([operation]) => ({ id: `cap.${operation}`, adapters: ["mirai_tasks"], operations: [operation], effects: [TASK_OPERATIONS[operation].effect], resource_prefixes: [`mirai-task:${registryDigest}`], approval_required: operation !== "collect" })) };
  const approvalRequests = main.nodes.filter(n => n.kind === "call").map(n => {
    const args = Object.fromEntries(Object.entries(n.args).map(([k, v]) => [k, v.value]));
    return buildCapabilityRequest({ run_id: "run.task-demo", program_digest: main.digest, input_digest: digestValue({}), args_digest: digestValue(args), node_id: n.id,
      adapter: "mirai_tasks", action: n.target.operation, resource: taskOperationResource(n.target.operation, args), effects: n.effects, capability: n.capability,
      budget: { max_calls: 1, max_bytes: 1000000, timeout_ms: 30000 }, policy_digest: policyDigest(capabilityPolicy), approval_required: n.target.operation !== "collect" });
  });
  const reference = (filename, value) => ({ path: filename, content_digest: digestValue(value) });
  return { "graph.json": graph, "task-policy.json": policy, "task-plan.json": plan, "worker.mirai.json": program, "recording.json": recording, "main.mirai.json": main,
    "runtime-config.json": { policy: capabilityPolicy }, "approval-requests.json": approvalRequests,
    "registry.json": { contract_version: "1.0.0", graph: reference("graph.json", graph), policy: reference("task-policy.json", policy), plan: reference("task-plan.json", plan),
      receivers: [{ kind: "program", id: worker.id, program: reference("worker.mirai.json", program), evidence_id: "evidence.classification" },
        { kind: "recorded_ai", recording: reference("recording.json", recording) }], canonical_write_allowed: false } };
}
module.exports = { buildFixture };
if (require.main === module) buildFixture().then(files => {
  for (const [name, data] of Object.entries(files)) {
    const target = path.join(root, "examples/mirai-task-runtime-minimal", name); const text = `${JSON.stringify(data, null, 2)}\n`;
    if (process.argv.includes("--check")) { if (!fs.existsSync(target) || readPortableText(target) !== text) throw new Error(`task_fixture_stale:${name}`); }
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); }
  }
  console.log(`Task Runtime fixtures verified/generated: ${Object.keys(files).length}`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
