#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { digestValue } = require("../../dist/cjs/core");
const { compileProgramSource } = require("../../dist/cjs/program");
const { executePure } = require("../../dist/cjs/runtime");
const { createGraphSnapshot, projectAccessibleSnapshot, standardOperationCatalog } = require("../../dist/cjs/stdlib");
const { proposeRuleClusters } = require("../../dist/cjs/knowledge");
const { TaskHost, createTaskPolicy, prepareTaskPlan, taskContextView, programTaskReceiver, recordedTaskReceiver, replayTasks } = require("../../dist/cjs/tasks");
const { fixtureInput, oracle } = require("../../test/fixtures/graph-organization.cjs");
const literal = value => ({ op: "literal", value });
const ref = path => ({ op: "ref", path });
const get = (target, key) => ({ op: "get", target, key });
const compile = value => compileProgramSource(JSON.stringify(value), "computed-pilot.json").program;
const policies = { allowed_effects: ["pure"], canonical_write_allowed: false,
  budgets: { max_steps: 64, max_depth: 5, max_iterations: 16, max_parallel: 3, max_duration_ms: 5000 } };
const resultType = { kind: "record", fields: { score: "int64", route: "string" } };
const topics = ["requirements", "safety", "verification"];
const members = { requirements: ["requirements.a"], safety: ["requirements.a", "safety.a"], verification: ["verification.a"] };
const limits = { requirements: 4, safety: 6, verification: 3 };
// Frozen input matrix and independent arithmetic oracle; no interpreter output trains the oracle.
const cases = [{ risk: 0, load: 0 }, { risk: 2, load: 1 }, { risk: 4, load: 2 }, { risk: 1, load: 4 }];
const expectedFor = input => ({ score: input.risk + input.load, route: input.risk + input.load >= input.limit ? "review" : "ordinary" });

async function runComputedPilot() {
  const sum = compile({ id: "program.score", version: "1.0.0", entry: "sum", inputs: [{ id: "risk", type: "int64" }, { id: "load", type: "int64" }],
    outputs: [{ id: "score", type: "int64" }], state: [{ id: "score", type: "int64", default: 0 }], nodes: [
      { id: "sum", kind: "call", target: { kind: "adapter", adapter: "pure", operation: "add_int64" }, effects: ["pure"], args: { left: ref("input.risk"), right: ref("input.load") }, result: "score", next: "done" },
      { id: "done", kind: "return", values: { score: ref("state.score") } }], policies });
  const worker = compile({ id: "program.classify", version: "1.0.0", entry: "compute", imports: [{ alias: "score", ref: sum.id, digest: sum.digest }],
    inputs: ["risk", "load", "limit"].map(id => ({ id, type: "int64" })), outputs: [{ id: "score", type: "int64" }, { id: "route", type: "string" }],
    state: [{ id: "computed", type: { kind: "record", fields: { score: "int64" } }, default: { score: 0 } }], nodes: [
      { id: "compute", kind: "call", target: { kind: "program", program: "score" }, args: { risk: ref("input.risk"), load: ref("input.load") }, result: "computed", next: "route" },
      { id: "route", kind: "branch", condition: { op: "gte", left: get(ref("state.computed"), "score"), right: ref("input.limit") }, then: "review", else: "ordinary" },
      ...["review", "ordinary"].map(route => ({ id: route, kind: "return", values: { score: get(ref("state.computed"), "score"), route: literal(route) } }))
    ], policies });
  const programs = { [sum.id]: sum, [worker.id]: worker };
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-computed-pilot-"));
  const results = [];
  let conformance;
  try {
    for (const [index, value] of cases.entries()) {
      const input = fixtureInput();
      for (const obj of input.objects) obj.metadata = { ...obj.metadata, risk: value.risk, load: value.load };
      const graph = projectAccessibleSnapshot(createGraphSnapshot(input), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
      const clusters = proposeRuleClusters(graph, { id: "policy.topics", keys: ["topics"], max_groups: 16, max_group_size: 16, max_memberships: 64 });
      const assigned = Object.fromEntries(clusters.groups.filter(g => g.scope === "client.a").map(g => [g.value, g.member_ids]));
      assert.deepEqual(assigned, members);
      const inputs = Object.fromEntries(topics.map(topic => {
        const objects = members[topic].map(id => graph.objects.find(o => o.id === id));
        return [topic, { risk: Math.max(...objects.map(o => o.metadata.risk)), load: objects.reduce((n, o) => n + o.metadata.load, 0), limit: limits[topic] }];
      }));
      const expected = Object.fromEntries(topics.map(topic => [topic, expectedFor(inputs[topic])]));
      const manual = Object.fromEntries(await Promise.all(topics.map(async topic => [topic, (await executePure(worker, inputs[topic], { programs })).outputs])));
      assert.deepEqual(manual, expected);
      const explicit = compile({ id: "program.explicit", version: "1.0.0", imports: [{ alias: "worker", ref: worker.id, digest: worker.digest }], entry: "workers",
        state: [{ id: "results", type: { kind: "list", items: resultType }, default: [] }], outputs: [{ id: "results", type: { kind: "list", items: resultType } }], nodes: [
          { id: "workers", kind: "parallel", branches: topics.map(topic => ({ id: topic, program: "worker", input: Object.fromEntries(Object.entries(inputs[topic]).map(([k, v]) => [k, literal(v)])) })), max_parallel: 3, merge: "array", result: "results", next: "done" },
          { id: "done", kind: "return", values: { results: ref("state.results") } }], policies });
      const legacy = await executePure(explicit, {}, { programs });
      assert.deepEqual(legacy.outputs.results, topics.map(topic => expected[topic]));
      const replayDigests = [];
      for (const order of [topics, [...topics].reverse()]) {
        const invocations = [];
        const receivers = topics.map(topic => {
          const receiver = programTaskReceiver({ id: `worker.${topic}`, program: worker, programs: { [sum.id]: sum }, evidence_id: "evidence.computed" });
          return { ...receiver, async execute(input, context) {
            assert.deepEqual(context.view.object_ids, assigned[topic]); invocations.push(topic);
            await new Promise(resolve => setTimeout(resolve, order.indexOf(topic) * 2));
            return receiver.execute(input, context);
          } };
        });
        const ids = [...receivers.map(r => r.id), "worker.report"];
        const policy = createTaskPolicy({ id: "policy.computed", owner: "owner", reviewers: ["reviewer.oracle"],
          participants: ["owner", ...ids].map(id => ({ id, object_ids: oracle.scope_a, source_ids: ["source.shared"], delegate_to: ids })),
          max_depth: 2, max_tasks: 4, max_parallel: 3, max_duration_ms: 60000, max_output_bytes: 10000, max_model_calls: 1 });
        const requests = topics.map(topic => ({ id: `task.${topic}`, parent_id: null, receiver_id: `worker.${topic}`, receiver_digest: receivers.find(r => r.id === `worker.${topic}`).digest,
          object_ids: assigned[topic], input: inputs[topic], dependencies: [], required_evidence: ["evidence.computed"], deadline: "2099-01-01T00:00:00.000Z", outcome: "Compute the risk score and route using the fixed threshold" }));
        const reportRequest = { id: "task.summary", parent_id: null, receiver_id: "worker.report", receiver_digest: digestValue("unbound"), object_ids: [...new Set(Object.values(members).flat())].sort(),
          input: { title: "Review summary" }, dependencies: requests.map(r => ({ task_id: r.id, requires: "accepted" })), required_evidence: ["evidence.summary"], deadline: "2099-01-01T00:00:00.000Z", outcome: "Summarize accepted specialist decisions" };
        requests.push(reportRequest);
        const dependencyRecording = {};
        for (const topic of topics) {
          const receiver = programTaskReceiver({ id: `worker.${topic}`, program: worker, programs: { [sum.id]: sum }, evidence_id: "evidence.computed" });
          dependencyRecording[`task.${topic}`] = await receiver.execute(inputs[topic], { signal: new AbortController().signal });
        }
        const summary = { decisions: topics.map(topic => `${topic}:${expected[topic].route}`).join(",") };
        const recorded = recordedTaskReceiver({ contract_version: "1.0.0", id: "worker.report", kind: "recorded_ai",
          input_type: { kind: "record", fields: { title: "string" } }, output_type: { kind: "record", fields: { decisions: "string" } }, recordings: [{
            task_id: reportRequest.id, input_digest: digestValue(reportRequest.input), view_digest: taskContextView(graph, policy, reportRequest, requests).digest,
            dependencies_digest: digestValue(dependencyRecording), result: { output: summary, evidence: [{ id: "evidence.summary", digest: digestValue(summary) }] } }] });
        reportRequest.receiver_digest = recorded.digest;
        receivers.push({ ...recorded, async execute(input, context) { invocations.push("report"); return recorded.execute(input, context); } });
        const plan = prepareTaskPlan("plan.computed", graph, policy, requests, receivers);
        let host, run;
        host = new TaskHost({ home: path.join(temp, `${index}.${replayDigests.length}`), sandbox: path.join(temp, "sandbox"), graph, policy, receivers,
          authorize: decision => {
            if (decision.action !== "accept") return ["create", "dispatch", "inference"].includes(decision.action);
            const task = host.inspect(run).tasks[decision.task_id];
            const wanted = decision.task_id === reportRequest.id ? summary : expected[decision.task_id.slice(5)];
            return decision.actor === "reviewer.oracle" && decision.verdict === "accepted" && task.result_digest === decision.result_digest && digestValue(task.result.output) === digestValue(wanted);
          } });
        run = host.create(plan); await host.runReady(run);
        assert.equal(host.inspect(run).tasks[reportRequest.id].state, "submitted");
        assert.equal(host.collect(run).status, "incomplete");
        for (const topic of topics) {
          const task = host.inspect(run).tasks[`task.${topic}`]; assert.deepEqual(task.result.output, expected[topic]);
          host.accept(run, task.request.id, "reviewer.oracle", task.result_digest, "accepted");
        }
        await host.runReady(run);
        const summaryTask = host.inspect(run).tasks[reportRequest.id]; assert.deepEqual(summaryTask.result.output, summary);
        assert.equal(host.collect(run).status, "incomplete");
        host.accept(run, reportRequest.id, "reviewer.oracle", summaryTask.result_digest, "accepted");
        assert.equal(host.collect(run).status, "accepted");
        await host.runReady(run); assert.equal(invocations.length, 4);
        const record = host.replayRecord(run), history_record = host.historyReplayRecord(run);
        replayDigests.push(replayTasks(record, graph, policy, receivers).digest);
        conformance = { graph, policy, record, history_record, receivers: receivers.map(({ execute, ...r }) => r), clusters,
          public_graph: graph, public_clusters: clusters, catalog: standardOperationCatalog() };
      }
      assert.equal(new Set(replayDigests).size, 1);
      results.push({ case: index, input: value, expected, conditions: ["manual_fixed_assignment", "program_1_0_explicit", "cluster_tasks"].map(condition => ({ condition, correct: 3, required: 3 })),
        replay_digest: replayDigests[0], schedules_match: true, recorded_ai_calls_per_schedule: 1, network_model_calls: 0, duplicate_work: 0, premature_acceptance: 0 });
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  const report = { kind: "computed_local_organization_pilot", cases: results, program_digest: worker.digest, imported_program_digest: sum.digest,
    canonical_write_allowed: false, limitations: ["Synthetic arithmetic and authored metadata, not representative human work quality.",
      "The fixed-assignment and explicit Program baselines use the same current interpreter, not a historical installation.",
      "Recorded AI cases are constructed from exact local dependencies; they test binding and gating, not model inference.",
      "No speedup, cost reduction, human review or production readiness claim."] };
  return { report: { ...report, digest: digestValue(report) }, conformance };
}
module.exports = { runComputedPilot };
if (require.main === module) runComputedPilot().then(result => {
  if (process.argv.length !== 2 && !(process.argv.length === 4 && process.argv[2] === "--out")) throw new Error("usage: [--out <new directory>]");
  if (process.argv[2]) {
    const out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
    for (const [name, value] of Object.entries(result)) fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(result.report, null, 2));
}).catch(error => { console.error(error); process.exitCode = 1; });
