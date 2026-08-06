#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { applyMigration, migratePlan, readJson, sha256, validateManifest } = require("./graph-manifest");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `mirai-graph-v2-${name}-`));
  writeJson(path.join(root, "graph", "objects.json"), [{ id: "object.one" }]);
  writeJson(path.join(root, "graph", "relations.json"), []);
  return root;
}

const checked = [];
const combined = fixture("combined");
writeJson(path.join(combined, "graph.json"), {
  $schema: "https://schemas.simai.io/mirai-graph/graph.schema.json", format: "mirai-graph", schema_version: "1.0.0",
  workspace_id: "workspace.legacy", scope: "repository", title: "Combined", owner: "dev",
  local: { graph_id: "graph.canonical", path: "graph", profiles: ["software_specification"] }, imports: []
});
writeJson(path.join(combined, "graph", "graph.json"), {
  schema_version: "1.0.0", graph_id: "graph.canonical", title: "Combined", graph_type: "repository", owner: "dev",
  source_of_truth: ["graph"], schemas_path: "graph/schemas", generated_path: "graph/generated"
});
writeJson(path.join(combined, "mirai-graph-package.json"), {
  schema_version: "1.0.0", id: "package.legacy", name: "Combined", version: "1.0.0", profile: "software_specification",
  conformance_level: "level_1", graph: { objects: "graph/objects.json", relations: "graph/relations.json" }, public_safety: {}, nonclaims: [], owner: "dev"
});
const graphDataBefore = sha256(fs.readFileSync(path.join(combined, "graph", "objects.json")));
const preview = migratePlan(combined);
assert.equal(preview.manifest_status, "legacy");
assert.equal(preview.identity_map.canonical, "graph.canonical");
assert.deepEqual(preview.identity_map.aliases, ["package.legacy", "workspace.legacy"]);
const applied = applyMigration(combined);
assert.equal(applied.manifest_status, "current");
assert.equal(applied.writes_performed, true);
assert.equal(fs.existsSync(path.join(combined, "graph", "graph.json")), false);
assert.equal(fs.existsSync(path.join(combined, "mirai-graph-package.json")), false);
assert.equal(sha256(fs.readFileSync(path.join(combined, "graph", "objects.json"))), graphDataBefore);
assert.equal(applyMigration(combined).writes_performed, false);
checked.push("combined legacy migration", "identity preservation", "graph data preservation", "repeat apply idempotence");

const conflict = fixture("identity-conflict");
writeJson(path.join(conflict, "graph.json"), { format: "mirai-graph", schema_version: "1.0.0", id: "workspace", title: "Conflict", owner: "dev", local: { graph_id: "graph.a", path: "graph" }, imports: [] });
writeJson(path.join(conflict, "graph", "graph.json"), { schema_version: "1.0.0", graph_id: "graph.b", title: "Conflict", graph_type: "repository", owner: "dev" });
assert(migratePlan(conflict).conflicts.some((item) => item.startsWith("manifest_identity_conflict")));
checked.push("identity conflict fail closed");

const unknown = fixture("unknown");
writeJson(path.join(unknown, "graph", "graph.json"), { schema_version: "1.0.0", graph_id: "graph.unknown", title: "Unknown", graph_type: "repository", owner: "dev", surprise: true });
assert(migratePlan(unknown).conflicts.some((item) => item.startsWith("review_required")));
checked.push("unknown legacy fields require review");

const invalidV2 = { ...readJson(path.join(combined, "graph.json")), surprise: true };
assert(validateManifest(invalidV2).includes("unknown v2 field surprise"));
checked.push("unknown v2 fields rejected");

console.log(JSON.stringify({ mode: "graph_manifest_v2_migration", valid: true, checked }, null, 2));
