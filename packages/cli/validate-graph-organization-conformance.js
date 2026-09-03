#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { digestValue } = require("../../dist/cjs/core");
const { assertSnapshot, standardOperationCatalogDigest } = require("../../dist/cjs/stdlib");
const { assertClusterProposal, proposeRuleClusters, importProviderClusters } = require("../../dist/cjs/knowledge");
const { replayTasks } = require("../../dist/cjs/tasks");
const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--bundle", "--checker", "--python"].includes(args[i]) || !args[i + 1] || Object.hasOwn(options, args[i])) throw new Error("invalid_conformance_arguments");
  options[args[i]] = args[i + 1];
}
if (Object.keys(options).length !== 3) throw new Error("usage: --bundle <json> --checker <python-repo> --python <executable>");
const bundle = JSON.parse(fs.readFileSync(options["--bundle"], "utf8"));
const seal = object => { const { digest, ...body } = object; object.digest = digestValue(body); };
const firstTask = value => Object.values(value.record.ledger.tasks)[0];
const scopeRecord = value => {
  const ledger = value.record.ledger;
  ledger.contract_version = "1.1.0"; ledger.execution_scope = digestValue("synthetic.parent.one");
  for (const [task, record] of Object.entries(ledger.tasks)) record.idempotency_key = digestValue({ plan: ledger.plan.digest, task, request: record.request_digest, execution_scope: ledger.execution_scope });
  seal(value.record);
};
const rebind = value => {
  const ledger = value.record.ledger;
  seal(value.policy); ledger.policy_digest = value.policy.digest; ledger.plan.policy_digest = value.policy.digest;
  seal(ledger.plan);
  for (const request of ledger.plan.requests) {
    const task = ledger.tasks[request.id]; task.request = structuredClone(request); task.request_digest = digestValue(request);
    task.idempotency_key = digestValue({ plan: ledger.plan.digest, task: request.id, request: task.request_digest });
    if (task.acceptance_receipt) task.acceptance_receipt.decision_digest = digestValue({ reviewer: task.acceptance_receipt.reviewer,
      task_id: request.id, result_digest: task.result_digest, verdict: task.acceptance, plan_digest: ledger.plan.digest });
  }
  seal(value.record);
};
const neighborhood = value => {
  value.clusters = proposeRuleClusters(value.graph, { ...value.clusters.policy,
    neighborhood: { relation_types: ["depends_on"], now: "2026-09-03T00:00:00Z", max_depth: 4 } });
};
const provider = value => {
  const groups = value.clusters.groups.map(({ scope, key, value, member_ids }) => ({ scope, key, value, member_ids }));
  value.clusters = importProviderClusters(value.graph, value.clusters.policy, "recorded.provider", { groups });
};
const cases = [
  { id: "neighborhood", expected: true, mutate: neighborhood },
  { id: "neighborhood_missing_dependency", expected: false, mutate: value => {
    neighborhood(value); const group = value.clusters.groups.find(g => g.scope === "client.a");
    group.member_ids = [group.member_ids[0]]; const { revision_digest, ...body } = group; group.revision_digest = digestValue(body); seal(value.clusters);
  } },
  { id: "recorded_provider", expected: true, mutate: provider },
  { id: "provider_input_binding", expected: false, mutate: value => { provider(value); value.clusters.provider_record.input_digest = digestValue("other"); seal(value.clusters); } },
  { id: "provider_cross_scope", expected: false, mutate: value => {
    provider(value); const group = value.clusters.groups.find(g => g.scope === "client.a"); group.member_ids = ["verification.b"];
    const { revision_digest, ...body } = group; group.revision_digest = digestValue(body); seal(value.clusters);
  } },
  { id: "context_digest", expected: false, mutate: value => { firstTask(value).input_snapshot_digest = digestValue("other"); seal(value.record); } },
  { id: "source_attenuation", expected: false, mutate: value => {
    value.policy.participants.find(p => p.id === firstTask(value).request.receiver_id).source_ids = []; rebind(value);
  } },
  { id: "object_attenuation", expected: false, mutate: value => {
    value.policy.participants.find(p => p.id === firstTask(value).request.receiver_id).object_ids = []; rebind(value);
  } },
  { id: "dependency_context_leak", expected: false, mutate: value => {
    const requests = value.record.ledger.plan.requests; const narrow = requests.find(r => r.id === "task.requirements");
    narrow.dependencies = [{ task_id: "task.safety", requires: "verified" }]; rebind(value);
  } },
  { id: "parent_scope_leak", expected: false, mutate: value => {
    value.record.ledger.plan.requests.find(r => r.id === "task.safety").parent_id = "task.requirements"; rebind(value);
  } },
  { id: "chronological_history", expected: true, mutate: value => { value.record = value.history_record; } },
  { id: "history_reordered", expected: false, mutate: value => { value.record = value.history_record; value.record.ledger.history.reverse(); seal(value.record); } },
  { id: "history_omitted", expected: false, mutate: value => { value.record = value.history_record; value.record.ledger.history = []; seal(value.record); } },
  { id: "history_false_transition", expected: false, mutate: value => { value.record = value.history_record; value.record.ledger.history[0].kind = "verify"; seal(value.record.ledger.history[0]); seal(value.record); } },
  { id: "history_reservation_forged", expected: false, mutate: value => { value.record = value.history_record; value.record.ledger.history[0].reserved_model_calls = 1; seal(value.record.ledger.history[0]); seal(value.record); } },
  { id: "valid", expected: true, mutate: () => {} },
  { id: "scoped_parent", expected: true, mutate: scopeRecord },
  { id: "cross_parent_key", expected: false, mutate: value => { scopeRecord(value); value.record.ledger.execution_scope = digestValue("synthetic.parent.two"); seal(value.record); } },
  { id: "scope_version_downgrade", expected: false, mutate: value => { scopeRecord(value); value.record.ledger.contract_version = "1.0.0"; seal(value.record); } },
  { id: "outer_digest", expected: false, mutate: value => { value.record.digest = digestValue("forged"); } },
  { id: "result_digest", expected: false, mutate: value => { firstTask(value).result_digest = digestValue("wrong"); seal(value.record); } },
  { id: "unverified_completion", expected: false, mutate: value => { firstTask(value).receipt_state = "uncertain"; seal(value.record); } },
  { id: "self_acceptance", expected: false, mutate: value => { const task = firstTask(value); task.acceptance_receipt.reviewer = task.request.receiver_id; seal(value.record); } },
  { id: "missing_evidence", expected: false, mutate: value => { const task = firstTask(value); task.result.evidence = []; task.result_digest = digestValue(task.result); seal(value.record); } },
  { id: "wrong_cluster_membership", expected: false, mutate: value => { value.clusters.groups[0].member_ids = ["unclassified"]; seal(value.clusters); } },
  { id: "catalog_binding", expected: false, mutate: value => { value.record.ledger.plan.catalog_digest = digestValue("wrong"); seal(value.record.ledger.plan); seal(value.record); } }
];
function checkTs(value) {
  try {
    assertSnapshot(value.graph); assertSnapshot(value.public_graph);
    if (value.catalog.digest !== standardOperationCatalogDigest()) throw new Error("catalog_mismatch");
    assertClusterProposal(value.graph, value.clusters); assertClusterProposal(value.public_graph, value.public_clusters);
    replayTasks(value.record, value.graph, value.policy, value.receivers);
    return true;
  } catch { return false; }
}
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-conformance-organization-"));
try {
  const results = cases.map(item => {
    const value = structuredClone(bundle); item.mutate(value);
    const filename = path.join(temp, `${item.id}.json`);
    fs.writeFileSync(filename, JSON.stringify(value));
    const python = spawnSync(options["--python"], ["-m", "mirai_conformance.organization", filename, "--schemas", path.join(root, "schemas")], {
      cwd: path.resolve(options["--checker"]), encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONPATH: path.resolve(options["--checker"]), PYTHONDONTWRITEBYTECODE: "1" }
    });
    if (python.error || ![0, 1].includes(python.status)) throw new Error(`independent_checker_unavailable:${item.id}`);
    let independent;
    try { independent = JSON.parse(python.stdout); } catch { throw new Error(`independent_checker_bad_output:${item.id}`); }
    if (typeof independent.valid !== "boolean" || independent.valid !== (python.status === 0)) throw new Error("independent_checker_exit_mismatch");
    const ts = checkTs(value);
    return { id: item.id, expected: item.expected, typescript: ts, python: independent.valid,
      passed: ts === item.expected && independent.valid === item.expected };
  });
  const report = { valid: results.every(r => r.passed), corpus: `local_organization_${cases.length}_cases`, results,
    limitations: ["Agreement covers this bounded corpus only, not all 2.3 contracts.", "Separate implementation is not an external human security review."], canonical_write_allowed: false };
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
