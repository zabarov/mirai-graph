#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { digestValue, sha256 } = require("../../dist/cjs/core");
const { compileProgramSource } = require("../../dist/cjs/program");
const { executePure } = require("../../dist/cjs/runtime");
const { createGraphSnapshot, projectAccessibleSnapshot, standardOperationCatalog } = require("../../dist/cjs/stdlib");
const { proposeRuleClusters } = require("../../dist/cjs/knowledge");
const { createTaskPolicy, prepareTaskPlan, programTaskReceiver, replayTasks, TaskHost } = require("../../dist/cjs/tasks");
const { snapshot, oracle } = require("../../test/fixtures/graph-organization.cjs");
const root = path.resolve(__dirname, "../..");

const expected = {
  requirements: { ids: ["requirements.a"], outcome: "requirements_checked" },
  safety: { ids: ["requirements.a", "safety.a"], outcome: "safety_checked" },
  verification: { ids: ["verification.a"], outcome: "verification_checked" }
};
const budgets = { max_steps: 16, max_depth: 4, max_parallel: 4, max_iterations: 16, max_duration_ms: 1000 };
const policies = { budgets, allowed_effects: ["pure"], canonical_write_allowed: false };
function worker(topic) {
  return compileProgramSource(JSON.stringify({ id: `worker.${topic}`, version: "1.0.0", entry: "done",
    outputs: [{ id: "outcome", type: "string" }],
    nodes: [{ id: "done", kind: "return", values: { outcome: { op: "literal", value: expected[topic].outcome } } }], policies
  }), `${topic}.mirai.json`).program;
}

function publicDocumentGraph() {
  const files = ["standard/graph-operations.md", "standard/process-control-contract.md", "standard/technology-quality-feedback.md"];
  return createGraphSnapshot({ contract_version: "1.0.0", id: "public.docs", canonical_write_allowed: false,
    sources: files.map((file, index) => ({ id: `source.public.${index}`, owner_ref: "owner.mirai", digest: sha256(fs.readFileSync(path.join(root, file))), confidentiality: "public" })),
    objects: files.map((file, index) => ({ id: `document.${index}`, kind: "standard", scope: "mirai.docs",
      metadata: { topics: index === 0 ? ["organization", "control"] : ["control"] }, source_refs: [`source.public.${index}`] })), relations: []
  });
}

async function runPilot() {
  const graph = projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
  const policy = { id: "policy.pilot", keys: ["topics"], max_groups: 16, max_group_size: 16, max_memberships: 64 };
  const clusters = proposeRuleClusters(graph, policy);
  const assignments = clusters.groups.filter(g => g.scope === "client.a");
  assert.deepEqual(Object.fromEntries(assignments.map(g => [g.value, g.member_ids])), Object.fromEntries(Object.entries(expected).map(([topic, value]) => [topic, value.ids])));
  const topics = Object.keys(expected).sort();
  const programs = Object.fromEntries(topics.map(topic => [topic, worker(topic)]));

  // Fixed assignments are an explicit deterministic baseline, not a model baseline.
  const manual = [];
  for (const topic of topics) manual.push((await executePure(programs[topic], {})).outputs.outcome);
  const explicit = compileProgramSource(JSON.stringify({ id: "pilot.explicit", version: "1.0.0",
    imports: topics.map(topic => ({ alias: topic, ref: programs[topic].id, digest: programs[topic].digest })),
    state: [{ id: "results", type: { kind: "list", items: { kind: "record", fields: { outcome: "string" } } }, default: [] }],
    outputs: [{ id: "results", type: { kind: "list", items: { kind: "record", fields: { outcome: "string" } } } }], entry: "workers",
    nodes: [
      { id: "workers", kind: "parallel", branches: topics.map(topic => ({ id: topic, program: topic, input: {} })), max_parallel: 3, merge: "array", result: "results", next: "done" },
      { id: "done", kind: "return", values: { results: { op: "ref", path: "state.results" } } }
    ], policies
  }), "explicit.mirai.json").program;
  const legacy = await executePure(explicit, {}, { programs: Object.fromEntries(topics.map(topic => [programs[topic].id, programs[topic]])) });
  assert.deepEqual(legacy.outputs.results.map(r => r.outcome).sort(), [...manual].sort());

  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-organization-pilot-"));
  const replayDigests = [];
  let savedRecord, savedHistory, taskPolicy, receiverDescriptors;
  try {
    for (const schedule of [topics, [...topics].reverse()]) {
      const invoked = [];
      const receivers = topics.map(topic => {
        const receiver = programTaskReceiver({ id: `worker.${topic}`, program: programs[topic], evidence_id: "evidence.program" });
        return { ...receiver, async execute(input, context) {
          invoked.push(topic);
          assert.deepEqual(context.view.object_ids, expected[topic].ids);
          assert.equal(context.view.graph.sources.length, 1);
          await new Promise(resolve => setTimeout(resolve, schedule.indexOf(topic) * 3));
          return receiver.execute(input, context);
        } };
      });
      taskPolicy = createTaskPolicy({ id: "policy.pilot.tasks", owner: "owner.pilot", reviewers: ["reviewer.oracle"],
        participants: ["owner.pilot", ...receivers.map(r => r.id)].map(id => ({ id, object_ids: oracle.scope_a, source_ids: ["source.shared"], delegate_to: receivers.map(r => r.id) })),
        max_depth: 1, max_tasks: 16, max_parallel: 3, max_duration_ms: 10000, max_output_bytes: 10000, max_model_calls: 0 });
      const requests = assignments.map(group => {
        const receiver = receivers.find(r => r.id === `worker.${group.value}`);
        return { id: `task.${group.value}`, parent_id: null, receiver_id: receiver.id, receiver_digest: receiver.digest,
          object_ids: group.member_ids, input: {}, dependencies: [], required_evidence: ["evidence.program"],
          deadline: "2050-01-01T00:00:00.000Z", outcome: expected[group.value].outcome };
      });
      const plan = prepareTaskPlan("plan.pilot", graph, taskPolicy, requests, receivers);
      let host;
      host = new TaskHost({ home: path.join(temp, `run.${replayDigests.length}`), sandbox: path.join(temp, "sandbox"), graph, policy: taskPolicy, receivers,
        authorize: decision => {
          if (decision.action !== "accept") return ["create", "dispatch"].includes(decision.action);
          const task = host.inspect(run).tasks[decision.task_id];
          return decision.actor === "reviewer.oracle" && decision.verdict === "accepted" && task.result_digest === decision.result_digest && task.result.output.outcome === expected[decision.task_id.slice(5)].outcome;
        } });
      const run = host.create(plan);
      const ledger = await host.runReady(run);
      assert.equal(host.collect(run).status, "incomplete");
      for (const task of Object.values(ledger.tasks)) host.accept(run, task.request.id, "reviewer.oracle", task.result_digest, "accepted");
      assert.equal(host.collect(run).status, "accepted");
      assert.deepEqual(invoked.sort(), topics);
      savedRecord = host.replayRecord(run);
      savedHistory = host.historyReplayRecord(run);
      receiverDescriptors = receivers.map(({ execute, ...descriptor }) => descriptor);
      const report = replayTasks(savedRecord, graph, taskPolicy, receivers);
      replayDigests.push(report.digest);
      await host.runReady(run);
      assert.equal(invoked.length, 3);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  assert.equal(new Set(replayDigests).size, 1);
  assert.deepEqual([...manual].sort(), [...oracle.required_outcomes].sort());
  const docsGraph = publicDocumentGraph();
  const docsProposal = proposeRuleClusters(docsGraph, policy);
  assert.equal(docsProposal.groups.find(g => g.value === "control").member_ids.length, 3);
  assert.equal(docsProposal.groups.find(g => g.value === "organization").member_ids.length, 1);
  const result = {
    contract_version: "1.0.0", kind: "local_differential_pilot", graph_digest: graph.digest, oracle_digest: digestValue(oracle),
    conditions: ["manual_fixed_assignment", "program_1_0_explicit", "graph_cluster_assignment"].map(condition => ({ condition,
      required_outcomes: 3, correct_outcomes: 3, missing_outcomes: 0, duplicate_work: 0, worker_invocations: 3,
      model_calls: 0, canonical_writes: 0, review: "fixed_synthetic_oracle_not_human" })),
    completion_order_invariant: new Set(replayDigests).size === 1, replay_digest: replayDigests[0],
    explicit_program_digest: explicit.digest, explicit_trace_digest: legacy.trace_digest,
    public_docs: { graph_digest: docsGraph.digest, source_digests: docsGraph.sources.map(s => s.digest),
      group_count: docsProposal.groups.length, overlapping_documents: docsProposal.overlapping_ids.length, source_bodies_copied: false },
    limitations: ["Synthetic workers return predetermined outcomes; task difficulty and model quality are not evaluated.",
      "The comparison uses the same local interpreter for Program 1.0; it is not a run of an independently installed historical package.",
      "No statistical speedup, cost reduction, human review or production readiness is claimed.",
      "Public-document topic metadata is authored, not extracted by an AI model.",
      "Replay validates recorded decisions, not the truth of external evidence or reviewer identity."],
    canonical_write_allowed: false
  };
  return { report: { ...result, digest: digestValue(result) }, conformance: { graph, policy: taskPolicy, receivers: receiverDescriptors, record: savedRecord, history_record: savedHistory, clusters, public_graph: docsGraph, public_clusters: docsProposal, catalog: standardOperationCatalog() } };
}

if (require.main === module) runPilot().then(result => {
  if (process.argv.length !== 2 && !(process.argv.length === 4 && process.argv[2] === "--out")) throw new Error("usage: run-graph-organization-pilot.js [--out <directory>]");
  if (process.argv[2] === "--out") {
    const out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
    for (const [name, data] of Object.entries(result)) fs.writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
  }
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
}).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

module.exports = { runPilot };
