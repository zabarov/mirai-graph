"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const technology = require("../../packages/project-technology");

function folder(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-folder-inventory-"));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const manifest = { $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json", format: "mirai-graph", schema_version: "2.0.0", id: "fixture.folder",
    aliases: [], title: "Synthetic folder", scope: "repository", kind: "repository_graph",
    owner: "fixture-owner", profiles: ["project_management"], imports: [],
    graph: { root: "graph", source_of_truth: ["graph/specs"], objects: ["graph/specs/objects.json"],
      relations: ["graph/specs/relations.json"], schemas: [], generated: ["graph/generated"], raw_sources: ["README.md"] } };
  fs.mkdirSync(path.join(repo, "graph/specs"), { recursive: true });
  fs.writeFileSync(path.join(repo, "graph/specs/objects.json"), "[]");
  fs.writeFileSync(path.join(repo, "graph/specs/relations.json"), "[]");
  fs.writeFileSync(path.join(repo, "README.md"), "Original requirement");
  const save = () => fs.writeFileSync(path.join(repo, "graph.json"), JSON.stringify(manifest));
  save(); assert.equal(technology.status(repo).manifest_status, "current");
  return { repo, manifest, save };
}

test("no-Git declared source edit changes inventory; deletion blocks sync without writes", t => {
  const { repo } = folder(t); const stateRoot = path.join(repo, "local-test-state");
  assert.equal(technology.enable(repo, { stateRoot }).status, "success");
  const before = technology.inventory(repo);
  fs.appendFileSync(path.join(repo, "README.md"), " changed");
  assert.notEqual(technology.inventory(repo).inventory_digest, before.inventory_digest);
  assert.ok(technology.status(repo, { stateRoot }).blockers.includes("project_technology_inventory_stale"));
  fs.unlinkSync(path.join(repo, "README.md"));
  const manifestBefore = fs.readFileSync(path.join(repo, "graph.json"));
  const denied = technology.execute("sync", repo, { stateRoot, apply: true });
  assert.ok(denied.blockers.includes("inventory_declared_source_missing"));
  assert.equal(denied.changed, false);
  assert.deepEqual(fs.readFileSync(path.join(repo, "graph.json")), manifestBefore);
});
test("unlisted documents are not discovered; duplicate references preserve one entry", t => {
  const { repo, manifest, save } = folder(t);
  fs.writeFileSync(path.join(repo, "unlisted.txt"), "Unlisted text");
  manifest.graph.raw_sources.push("README.md"); save();
  const a = technology.inventory(repo), b = technology.inventory(repo);
  assert.deepEqual(a, b);
  assert.equal(a.files.filter(f => f.path === "README.md").length, 1);
  assert.equal(a.files.some(f => f.path === "unlisted.txt"), false);
});
for (const ref of ["../outside", "/absolute", "docs/*.md", "docs\\outside"]) {
  test(`unsafe declared reference is blocked: ${ref}`, t => {
    const { repo, manifest, save } = folder(t); manifest.graph.raw_sources.push(ref); save();
    const inventory = technology.inventory(repo);
    // Manifest validation may reject it before inventory traversal.
    assert.ok(inventory.blockers?.length || technology.status(repo).blockers.length);
    assert.notEqual(technology.execute("enable", repo, { apply: true }).status, "success");
  });
}
test("symlinked declared source is rejected", t => {
  const { repo } = folder(t);
  fs.renameSync(path.join(repo, "README.md"), path.join(repo, "actual.md"));
  try { fs.symlinkSync("actual.md", path.join(repo, "README.md")); }
  catch (error) { if (error.code === "EPERM") return t.skip("host cannot create file symlinks"); throw error; }
  assert.ok(technology.inventory(repo).blockers.includes("inventory_declared_source_unsafe_or_unsupported"));
});
test("broken Git metadata does not enable silent folder fallback", t => {
  const { repo } = folder(t); fs.writeFileSync(path.join(repo, ".git"), "gitdir: missing-git-dir\n");
  assert.ok(technology.inventory(repo).blockers.includes("inventory_git_unavailable"));
});
