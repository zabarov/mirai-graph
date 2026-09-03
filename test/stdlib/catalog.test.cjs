const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const { digestValue } = require("../../dist/cjs/core");
const { spawnSync } = require("node:child_process");
const { snapshot, relation } = require("../fixtures/graph-organization.cjs");
const { compileProgramSource } = require("../../dist/cjs/program");
const { executePure, replayPure } = require("../../dist/cjs/runtime");
const s = require("../../dist/cjs/stdlib");

test("catalog pins schemas and exposes only implemented pure operations", () => {
  const catalog = s.standardOperationCatalog();
  assert.equal(catalog.operations.length, 13);
  assert.equal(new Set(catalog.operations.map(x => x.id)).size, 13);
  assert.equal(catalog.operations.every(o => o.effect === "pure" && o.canonical_write_allowed === false), true);
  catalog.operations[0].id = "forged";
  assert.notDeepEqual(catalog, s.standardOperationCatalog());
  assert.throws(() => s.describeStandardOperation("task.delegate"), /unknown_standard_operation/);
  assert.throws(() => s.invokeStandardOperation("graph.query", {}, "sha256:" + "0".repeat(64)), /digest_mismatch/);
  assert.throws(() => s.invokeStandardOperation("graph.query", { graph: snapshot(), query: { max_objects: "2" } }, s.standardOperationCatalog().digest), /input_invalid/);
});

test("catalog invocations validate inputs and outputs for each implemented family", () => {
  const graph = snapshot(); const digest = s.standardOperationCatalog().digest;
  const invoke = (id, args) => s.invokeStandardOperation(id, args, digest);
  assert.equal(invoke("graph.validate", { graph }).valid, true);
  const { digest: ignored, ...body } = graph;
  assert.equal(invoke("graph.draft", { graph: body }).status, "proposed");
  assert.deepEqual(invoke("graph.diff", { before: graph, after: graph }).objects.changed, []);
  const rel = relation("new.relation", "requirements.a", "verification.a", { authority: "proposal" });
  assert.equal(invoke("relation.propose", { graph, relation: rel }).status, "proposed");
  const policy = { id: "policy.topics", keys: ["topics"], max_groups: 20, max_group_size: 20, max_memberships: 40 };
  const proposal = invoke("cluster.propose", { graph, policy });
  assert.equal(invoke("cluster.evaluate", { graph, proposal }).oracle_checked, false);
  assert.equal(invoke("cluster.materialize_view", { graph, proposal, group_id: proposal.groups[0].id }).object_ids.length > 0, true);
});

test("existing Program call executes the opt-in graph library and replays identically", async () => {
  const graph = snapshot();
  const source = { id: "program.graph_query", version: "1.0.0", inputs: [],
    state: [{ id: "selection", type: { kind: "record", fields: { object_ids: { kind: "list", items: "string" } } }, default: { object_ids: [] } }],
    outputs: [{ id: "ids", type: { kind: "list", items: "string" } }],
    entry: "query", nodes: [
      { id: "query", kind: "call", target: { kind: "adapter", adapter: "mirai_stdlib", operation: "graph.query" },
        args: { graph: { op: "literal", value: graph }, query: { op: "literal", value: { ids: ["requirements.a"] } } },
        effects: ["pure"], result: "selection", next: "done" },
      { id: "done", kind: "return", values: { ids: { op: "get", target: { op: "ref", path: "state.selection" }, key: "object_ids" } } }
    ], policies: { budgets: { max_steps: 8, max_depth: 2, max_iterations: 8, max_parallel: 2, max_duration_ms: 1000 }, allowed_effects: ["pure"], canonical_write_allowed: false } };
  const program = compileProgramSource(JSON.stringify(source), "fixture.mirai.json").program;
  const adapters = s.createStandardPureAdapters(s.standardOperationCatalog().digest);
  const episode = await executePure(program, {}, { adapters });
  assert.deepEqual(episode.outputs, { ids: ["requirements.a"] });
  assert.equal((await replayPure(episode, program, { adapters })).status, "match");
  await assert.rejects(executePure(program, {}), error => error.code === "adapter_operation_not_found");
});

test("public CLI lists/describes operations and rejects unknown commands and arguments", () => {
  const cli = path.resolve(__dirname, "../../packages/cli/mirai.js");
  const list = spawnSync(process.execPath, [cli, "stdlib", "list"], { encoding: "utf8" });
  assert.equal(list.status, 0, list.stderr);
  assert.equal(JSON.parse(list.stdout).digest, s.standardOperationCatalog().digest);
  const describe = spawnSync(process.execPath, [cli, "stdlib", "describe", "graph.project"], { encoding: "utf8" });
  assert.equal(describe.status, 0, describe.stderr);
  assert.equal(JSON.parse(describe.stdout).id, "graph.project");
  const unknown = spawnSync(process.execPath, [cli, "stdlib", "describe", "graph.grant"], { encoding: "utf8" });
  assert.notEqual(unknown.status, 0);
  const extra = spawnSync(process.execPath, [cli, "stdlib", "list", "--apply"], { encoding: "utf8" });
  assert.notEqual(extra.status, 0);
});

function versionedSource() {
  return { contract_version: "1.1.0", id: "versioned.stdlib", version: "1.0.0",
    operation_catalog: { id: "mirai.stdlib", contract_version: "1.0.0", digest: s.standardOperationCatalogDigest() },
    entry: "check", nodes: [
      { id: "check", kind: "call", target: { kind: "adapter", adapter: "mirai_stdlib", operation: "graph.validate" }, args: { graph: { op: "literal", value: snapshot() } }, effects: ["pure"], next: "done" },
      { id: "done", kind: "return", values: {} }
    ], policies: { budgets: { max_steps: 3, max_depth: 1, max_parallel: 1, max_iterations: 1, max_duration_ms: 1000 }, allowed_effects: ["pure"], canonical_write_allowed: false }
  };
}

test("Program 1.1 pins native catalog without changing Program 1.0 adapter behavior", async () => {
  const program = compileProgramSource(JSON.stringify(versionedSource()), "catalog.mirai.json").program;
  const adapters = { mirai_stdlib: { "graph.validate": () => { throw new Error("override forbidden"); } } };
  const episode = await executePure(program, {}, { adapters });
  assert.equal(episode.status, "completed");
  assert.equal((await replayPure(episode, program)).status, "match");
  assert.equal(episode.effects_executed, false);
});

test("Program 1.1 compilation rejects stale catalogs, missing arguments and invalid literal shapes", () => {
  for (const change of [
    source => { delete source.operation_catalog; },
    source => { source.operation_catalog.digest = "sha256:" + "0".repeat(64); },
    source => { source.contract_version = "1.0.0"; },
    source => { source.nodes[0].target.operation = "graph.unknown"; },
    source => { source.nodes[0].args = {}; },
    source => { source.nodes[0].args.graph.value = "not a graph"; },
    source => { source.nodes[0].args.extra = { op: "literal", value: true }; },
    source => { source.nodes[0].capability = "forged"; },
    source => { source.nodes[0].effects = ["repository_read"]; }
  ]) {
    const source = versionedSource(); change(source);
    assert.throws(() => compileProgramSource(JSON.stringify(source), "invalid.mirai.json"));
  }
});

test("component operations reuse existing dispatch and reject scope widening or ambiguity", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../examples/mirai-components-minimal/component-package.json"), "utf8"));
  const invoke = (id, args) => s.invokeStandardOperation(id, args, s.standardOperationCatalogDigest());
  const description = invoke("component.describe", { package: pkg, instance_id: "worker.prepare" });
  assert.equal(description.operations[0].id, "operation.execute");
  const snapshot = { id: "components.demo", components: pkg, relation_facts: [], policy_digest: digestValue("host.policy") };
  snapshot.graph_snapshot_digest = digestValue({ id: snapshot.id, components: pkg, relation_facts: [] });
  const signal = { id: "signal.demo", type: "work_requested", scope: "demo", now: "2026-09-03T00:00:00Z", goal: "Prepare work", operation: "operation.execute", component_refs: ["worker.prepare"] };
  const result = invoke("component.resolve", { snapshot, signal });
  assert.equal(result.activated_paths.length, 1);
  assert.equal(result.canonical_write_allowed, false);
  assert.throws(() => invoke("component.resolve", { snapshot, signal: { ...signal, scope: "other" } }), /scope_or_selection/);
  pkg.contextual_bindings.push({ ...pkg.contextual_bindings[0], id: "duplicate.binding" });
  assert.throws(() => invoke("component.describe", { package: pkg, instance_id: "worker.prepare" }), /semantics_invalid/);
});
