#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const { standardOperationSchemas, projectAccessibleSnapshot, standardOperationCatalog, invokeStandardOperation } = require("../../dist/cjs/stdlib");
const { snapshot, oracle } = require("../../test/fixtures/graph-organization.cjs");
const { TASK_PLAN_SCHEMA, TASK_POLICY_SCHEMA, TASK_REGISTRY_FILE_SCHEMA, RECORDED_TASK_RECEIVER_SCHEMA } = require("../../dist/cjs/tasks");
const policy = { id: "policy.topics", keys: ["topics"], max_groups: 20, max_group_size: 20, max_memberships: 40 };
const graph = projectAccessibleSnapshot(snapshot(), { object_ids: new Set(oracle.accessible), source_ids: new Set(["source.shared"]) });
const catalog = standardOperationCatalog();
const example = "examples/mirai-graph-operations-minimal";
const readPortableText = target => fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
const files = {
  "schemas/task-plan.schema.json": TASK_PLAN_SCHEMA,
  "schemas/task-policy.schema.json": TASK_POLICY_SCHEMA,
  "schemas/task-registry-file.schema.json": TASK_REGISTRY_FILE_SCHEMA,
  "schemas/recorded-task-receiver.schema.json": RECORDED_TASK_RECEIVER_SCHEMA,
  ...Object.fromEntries(Object.entries(standardOperationSchemas()).map(([name, schema]) => [`schemas/${name}`, schema])),
  [`${example}/graph.json`]: graph,
  [`${example}/query.json`]: { graph, query: { scopes: ["client.a"], metadata: { topics: "safety" } } },
  [`${example}/cluster.json`]: { graph, policy },
  [`${example}/expected-clusters.json`]: invokeStandardOperation("cluster.propose", { graph, policy }, catalog.digest),
  [`${example}/oracle.json`]: oracle
};
for (const [relative, value] of Object.entries(files)) {
  const target = path.join(root, relative);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || readPortableText(target) !== bytes) throw new Error(`fixture_stale:${relative}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
}
console.log(`Graph-operation schemas/fixtures ${process.argv.includes("--check") ? "verified" : "generated"}: ${Object.keys(files).length}`);
