const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const project = require("../../dist/cjs/project");

function temp(name) { return fs.mkdtempSync(path.join(os.tmpdir(), `mirai-project-${name}-`)); }
function cleanup(root) { fs.rmSync(root, { recursive: true, force: true }); }

function legacyProject() {
  const root = temp("legacy");
  fs.mkdirSync(path.join(root, "graph"), { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "# Legacy Project\n");
  fs.writeFileSync(path.join(root, "graph", "objects.json"), "[]\n");
  fs.writeFileSync(path.join(root, "graph", "relations.json"), "[]\n");
  fs.writeFileSync(path.join(root, "graph.json"), JSON.stringify({
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json", format: "mirai-graph", schema_version: "2.0.0",
    id: "project.legacy", aliases: [], title: "Legacy Project", scope: "repository", kind: "project_graph", owner: "repository_owner",
    profiles: ["project_management"], graph: { root: "graph", source_of_truth: ["graph"], objects: ["graph/objects.json"], relations: ["graph/relations.json"], schemas: [], generated: [], raw_sources: ["README.md"] }, imports: []
  }, null, 2));
  return root;
}

test("project init creates only the preferred capsule plus a compatibility facade", () => {
  const root = temp("init");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    const result = project.initProjectCapsule(root, "software_specification");
    assert.equal(result.canonical_write_allowed, false);
    for (const file of ["manifest.yaml", "manifest.lock.json", "START.md", "graph/objects.json"]) assert(fs.existsSync(path.join(root, "mirai", file)));
    assert(!fs.existsSync(path.join(root, "graph")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "graph.json"), "utf8")).graph.root, "mirai/graph");
    assert.equal(project.validateProjectCapsule(root).valid, true);
    assert.equal(project.detectProjectCapsule(root).status, "current");
  } finally { cleanup(root); }
});

test("equivalent YAML comments do not change lock or START", () => {
  const root = temp("determinism");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    const lockBefore = fs.readFileSync(path.join(root, "mirai", "manifest.lock.json"), "utf8");
    const startBefore = fs.readFileSync(path.join(root, "mirai", "START.md"), "utf8");
    fs.appendFileSync(path.join(root, "mirai", "manifest.yaml"), "\n# formatting-only owner comment\n");
    fs.appendFileSync(path.join(root, "mirai", "sources.yaml"), "\n# formatting-only source comment\n");
    project.compileProjectCapsule(root);
    assert.equal(fs.readFileSync(path.join(root, "mirai", "manifest.lock.json"), "utf8"), lockBefore);
    assert.equal(fs.readFileSync(path.join(root, "mirai", "START.md"), "utf8"), startBefore);
  } finally { cleanup(root); }
});

test("portable text entrypoint digests are stable across LF and CRLF checkouts", () => {
  const root = temp("line-endings");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    const objects = path.join(root, "mirai", "graph", "objects.json");
    const notes = path.join(root, "mirai", "owner-notes.md");
    const start = path.join(root, "mirai", "START.md");
    const lockBefore = JSON.parse(fs.readFileSync(path.join(root, "mirai", "manifest.lock.json"), "utf8"));
    fs.writeFileSync(objects, fs.readFileSync(objects, "utf8").replaceAll("\n", "\r\n"));
    fs.writeFileSync(notes, fs.readFileSync(notes, "utf8").replaceAll("\n", "\r\n"));
    fs.writeFileSync(start, fs.readFileSync(start, "utf8").replaceAll("\n", "\r\n"));
    const lockAfter = project.createProjectLock(root);
    assert.equal(lockAfter.entrypoint_digests["mirai/graph/objects.json"], lockBefore.entrypoint_digests["mirai/graph/objects.json"]);
    assert.equal(lockAfter.digest, lockBefore.digest);
    assert.equal(project.validateProjectCapsule(root).valid, true);
  } finally { cleanup(root); }
});

test("stale lock and manually edited START block current status", () => {
  const root = temp("stale");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    fs.writeFileSync(path.join(root, "mirai", "graph", "objects.json"), "[{\"id\":\"changed\"}]\n");
    assert.equal(project.detectProjectCapsule(root).status, "needs_compile");
    project.compileProjectCapsule(root);
    fs.appendFileSync(path.join(root, "mirai", "START.md"), "manual change\n");
    assert(project.validateProjectCapsule(root).errors.includes("stale_or_modified_generated_start"));
  } finally { cleanup(root); }
});

test("manifest rejects duplicate keys, aliases and authority minting", () => {
  const root = temp("invalid");
  try {
    fs.mkdirSync(path.join(root, "mirai"), { recursive: true });
    fs.writeFileSync(path.join(root, "mirai", "manifest.yaml"), "contract_version: 1.0.0\ncontract_version: 1.0.0\n");
    assert.throws(() => project.readProjectManifest(root), /invalid_yaml/);
    fs.writeFileSync(path.join(root, "mirai", "manifest.yaml"), "contract_version: 1.0.0\nproject: &project {id: x}\n");
    assert.throws(() => project.readProjectManifest(root), /yaml_aliases_not_allowed/);
    assert.throws(() => project.validateProjectManifest({ contract_version: "1.0.0", capability_grants: ["forged"] }), /manifest_cannot_mint_authority/);
  } finally { cleanup(root); }
});

test("manifest rejects unknown top-level and nested fields", () => {
  const root = temp("unknown-fields");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    const valid = project.readProjectManifest(root);
    assert.throws(() => project.validateProjectManifest({ ...valid, mystery: true }), /manifest_unknown_field:manifest\.mystery/);
    assert.throws(() => project.validateProjectManifest({ ...valid, project: { ...valid.project, hidden_mode: "unsafe" } }), /manifest_unknown_field:manifest\.project\.hidden_mode/);
  } finally { cleanup(root); }
});

test("capsule rejects symlinked source entrypoints", (context) => {
  if (process.platform === "win32") return context.skip("symlink fixture is POSIX-specific");
  const root = temp("symlink-entrypoint");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    const sources = path.join(root, "mirai", "sources.yaml");
    const outside = path.join(root, "outside-sources.yaml");
    fs.writeFileSync(outside, "contract_version: 1.0.0\nsources: []\n");
    fs.unlinkSync(sources);
    fs.symlinkSync(outside, sources);
    const validation = project.validateProjectCapsule(root);
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join(","), /project_entrypoint_symlink_forbidden/);
  } finally { cleanup(root); }
});

test("incompatible root graph is a fail-closed dual-root conflict", () => {
  const root = temp("dual");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root);
    const facade = JSON.parse(fs.readFileSync(path.join(root, "graph.json"), "utf8"));
    facade.id = "project.someone-else";
    fs.writeFileSync(path.join(root, "graph.json"), JSON.stringify(facade));
    assert.equal(project.detectProjectCapsule(root).status, "dual_root_conflict");
  } finally { cleanup(root); }
});

test("agent brief is task-scoped and cannot grant authority", () => {
  const root = temp("brief");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n");
    project.initProjectCapsule(root, "ai_employee");
    const brief = project.inspectProjectForAgent(root, "prepare a dry-run answer");
    assert.equal(brief.lock.fresh, true);
    assert.equal(brief.canonical_write_allowed, false);
    assert(brief.forbidden_actions.includes("mint_capability"));
    assert(!JSON.stringify(brief).includes(root));
  } finally { cleanup(root); }
});

test("migration dry-run is read-only and approved apply is idempotent", () => {
  const root = legacyProject();
  try {
    const before = fs.readdirSync(root).sort();
    const plan = project.planProjectMigration(root);
    assert.equal(plan.status, "ready");
    assert.deepEqual(fs.readdirSync(root).sort(), before);
    const approval = path.join(root, "approval.json");
    fs.writeFileSync(approval, JSON.stringify({ approval_id: "approval.test", action: "mirai_project_migration", project_root: root, approved: true, expires_at: new Date(Date.now() + 60000).toISOString() }));
    assert.equal(project.applyProjectMigration(root, approval).status, "applied");
    assert.equal(project.validateProjectCapsule(root).valid, true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "graph.json"), "utf8")).graph.root, "mirai/graph");
    assert.equal(project.applyProjectMigration(root, approval).status, "already_current");
    const rollbackApproval = path.join(root, "rollback-approval.json");
    fs.writeFileSync(rollbackApproval, JSON.stringify({ approval_id: "approval.rollback", action: "mirai_project_migration_rollback", project_root: root, approved: true, expires_at: new Date(Date.now() + 60000).toISOString() }));
    assert.equal(project.rollbackProjectMigration(root, rollbackApproval).status, "rolled_back");
    assert.equal(project.detectProjectCapsule(root).status, "legacy_detected");
    assert.equal(project.rollbackProjectMigration(root, rollbackApproval).status, "rolled_back");
  } finally { cleanup(root); }
});

test("migration blocks generated or runtime state from entering the portable capsule", () => {
  const root = legacyProject();
  try {
    fs.mkdirSync(path.join(root, "graph", "generated"), { recursive: true });
    fs.writeFileSync(path.join(root, "graph", "generated", "runtime-result.json"), "{}\n");
    const plan = project.planProjectMigration(root);
    assert.equal(plan.status, "blocked");
    assert(plan.conflicts.includes("legacy_graph_contains_nonportable_runtime_or_generated_state"));
  } finally { cleanup(root); }
});
