#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { createRequire } = require("module");
const { spawnSync } = require("child_process");
const technology = require("../project-technology");
const fixtureFile = path.join(__dirname, "validate-project-technology.js");
const fixtureText = fs.readFileSync(fixtureFile, "utf8");
const sandbox = { require: createRequire(fixtureFile), module: { exports: {} } };
vm.runInNewContext(fixtureText.slice(0, fixtureText.indexOf("const checks = [];")) +
  "\nmodule.exports={initRepo,addTarget,git,TARGET_ID,SEMANTIC_DIGEST};", sandbox);
const fixture = sandbox.module.exports;
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mirai-archive-test-")));
const originalPath = process.env.PATH;
const checks = [];
function check(id, condition, details) { checks.push({ id, passed: Boolean(condition) }); assert.ok(condition, `${id}: ${JSON.stringify(details)}`); }
function digestTree(dir) {
  const files = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else files.push([path.relative(dir, file), technology.sha256(fs.readFileSync(file))]);
    }
  }
  walk(dir); return technology.sha256(JSON.stringify(files.sort()));
}
try {
  const sourceRoot = path.join(root, "source"); fs.mkdirSync(sourceRoot);
  const provider = fixture.initRepo(sourceRoot, "fixture-provider");
  const consumer = fixture.initRepo(sourceRoot, "fixture-consumer");
  let revision = fixture.addTarget(provider);
  const stateRoot = path.join(root, "state");
  const base = { targetId: fixture.TARGET_ID, semanticDigest: fixture.SEMANTIC_DIGEST, stateRoot, apply: true };
  for (const repo of [provider, consumer]) assert.equal(technology.execute("enable", repo, base).status, "success");
  const releases = [];
  for (let n = 0; n < 2; n++) {
    if (n) { fixture.git(provider, "commit", "--allow-empty", "-qm", "compatible revision"); revision = fixture.git(provider, "rev-parse", "HEAD"); }
    const provided = technology.execute("provide", provider, { ...base, providerRevision: revision });
    assert.equal(provided.status, "success");
    const bytes = fs.readFileSync(path.join(provider, provided.export_ref));
    const source = path.join(root, `export-${n}.json`); fs.writeFileSync(source, bytes);
    // Build anchor on the verified SOURCE side, before Git is removed.
    const ancestors = n ? [releases[0].providerRevision] : [];
    for (const ancestor of ancestors) fixture.git(provider, "merge-base", "--is-ancestor", ancestor, revision);
    releases.push({ ...base, source, providerRevision: revision, providerArchive: {
      exportSha256: technology.sha256(bytes), graphId: "fixture-provider", providerRevision: revision, ancestorRevisions: ancestors,
    } });
  }
  const packedConsumer = path.join(root, "consumer");
  fs.cpSync(consumer, packedConsumer, { recursive: true, filter: file => path.basename(file) !== ".git" });
  const emptyPath = path.join(root, "no-tools"); fs.mkdirSync(emptyPath); process.env.PATH = emptyPath;
  check("git_is_absent", spawnSync("git", ["--version"]).error?.code === "ENOENT");
  const invoke = options => technology.execute("connect", packedConsumer, options);
  const noTrust = { ...releases[0] }; delete noTrust.providerArchive;
  check("untrusted_archive_blocked", invoke(noTrust).blockers.includes("provider_revision_order_unverifiable"));
  const before = digestTree(root);
  check("preview", invoke({ ...releases[0], apply: false }).status === "preview");
  check("preview_zero_write", digestTree(root) === before);
  const connected = invoke(releases[0]);
  check("archive_connect", connected.status === "success", connected);
  check("complete_contract_imported", connected.target_binding.status === "ready", connected);
  const after = digestTree(root);
  check("repeat_changed_false", invoke(releases[0]).changed === false);
  check("repeat_byte_identical", digestTree(root) === after);
  const status = technology.execute("status", packedConsumer, base);
  check("read_only_ready", status.target_binding.status === "ready", status);
  technology.execute("verify", packedConsumer, base);
  check("diagnostics_zero_write", digestTree(root) === after);
  function denied(id, options, blocker) {
    const prior = digestTree(root); const result = invoke(options);
    check(id, result.status === "fail" && (!blocker || result.blockers.includes(blocker)), result);
    check(`${id}_zero_write`, prior === digestTree(root));
  }
  denied("null_trust", { ...releases[0], providerArchive: null }, "provider_archive_trust_invalid");
  denied("bad_digest", { ...releases[0], providerArchive: { ...releases[0].providerArchive, exportSha256: "0".repeat(64) } }, "provider_archive_export_digest_mismatch");
  denied("bad_graph", { ...releases[0], providerArchive: { ...releases[0].providerArchive, graphId: "other.provider" } }, "provider_archive_graph_mismatch");
  denied("bad_revision", { ...releases[0], providerArchive: { ...releases[0].providerArchive, providerRevision: "f".repeat(40) } }, "provider_archive_revision_mismatch");
  denied("extra_trust_fields", { ...releases[0], providerArchive: { ...releases[0].providerArchive, approved: true } }, "provider_archive_trust_invalid");
  denied("explicit_refresh_required", releases[1], "target_provider_refresh_required");
  denied("missing_ancestry", { ...releases[1], refreshBinding: true, providerArchive: { ...releases[1].providerArchive, ancestorRevisions: [] } }, "provider_revision_not_forward");
  denied("target_mismatch", { ...releases[1], targetId: "other.target", refreshBinding: true }, "target_provider_target_mismatch");
  denied("semantic_mismatch", { ...releases[1], semanticDigest: `sha256:${"3".repeat(64)}`, refreshBinding: true }, "target_provider_semantic_mismatch");
  const refreshed = invoke({ ...releases[1], refreshBinding: true });
  check("forward_refresh", refreshed.status === "success" && refreshed.changed, refreshed);
  const refreshedTree = digestTree(root);
  check("refresh_idempotent", invoke({ ...releases[1], refreshBinding: true }).changed === false);
  check("refresh_byte_identical", digestTree(root) === refreshedTree);
  denied("downgrade", { ...releases[0], refreshBinding: true }, "provider_revision_not_forward");
  const original = fs.readFileSync(releases[1].source);
  fs.appendFileSync(releases[1].source, " ");
  denied("tampered_bytes", { ...releases[1], refreshBinding: true }, "provider_archive_export_digest_mismatch");
  fs.writeFileSync(releases[1].source, original);
  function alteredExport(id, alter, expected) {
    const payload = JSON.parse(original); alter(payload);
    fs.writeFileSync(releases[1].source, technology.canonicalBytes(payload));
    const options = { ...releases[1], refreshBinding: true, providerArchive: { ...releases[1].providerArchive,
      exportSha256: technology.sha256(fs.readFileSync(releases[1].source)), graphId: payload.provider_graph_id } };
    denied(id, options, expected); fs.writeFileSync(releases[1].source, original);
  }
  alteredExport("provider_conflict", p => { p.provider_graph_id = "another.provider"; }, "target_provider_graph_conflict");
  alteredExport("incomplete_contract", p => { p.requirement_bindings = []; });
  alteredExport("contract_tamper", p => { p.goal_binding.done_when_ids = ["done.other"]; });
  alteredExport("valid_but_different_contract", p => {
    p.allowed_change_scope[0].file_patterns = ["packages/other/**"];
    p.execution_contract_digest = technology.sha256(technology.canonicalBytes(technology.normalizeExecutionContract(p).contract));
  }, "provider_execution_contract_refresh_mismatch");
  alteredExport("reviewed_not_accepted", p => { p.architecture_contract.lifecycle = "reviewed"; });
  alteredExport("private_extra_field", p => { p.private_source = "not allowed"; }, "provider_export_not_bounded");
  const graphFile = path.join(packedConsumer, "graph.json"); const graphBefore = fs.readFileSync(graphFile);
  const graph = JSON.parse(graphBefore); graph.extensions["mirai.project_technology"].enabled = false;
  fs.writeFileSync(graphFile, JSON.stringify(graph));
  denied("disabled", releases[1], "project_technology_not_enabled");
  check("disabled_diagnostics_available", technology.execute("status", packedConsumer, base).operation_mode === "read_only");
  fs.writeFileSync(graphFile, graphBefore);
  const trustFile = path.join(root, "trust.json"); fs.writeFileSync(trustFile, JSON.stringify(releases[1].providerArchive));
  const cli = spawnSync(process.execPath, [path.join(__dirname, "project-technology.js"), "connect", packedConsumer,
    "--source", releases[1].source, "--target-id", base.targetId, "--semantic-digest", base.semanticDigest,
    "--provider-revision", releases[1].providerRevision, "--state-root", stateRoot,
    "--provider-archive-trust", trustFile, "--apply"], { encoding: "utf8" });
  check("cli_no_git_idempotent", cli.status === 0 && JSON.parse(cli.stdout).changed === false, cli.stdout);
  // A new identity field is optional for historical Git exports, but required
  // for authenticated archive imports. Existing stored contracts remain valid.
  const legacy = JSON.parse(original); delete legacy.provider_graph_id;
  fs.writeFileSync(releases[1].source, technology.canonicalBytes(legacy));
  check("historical_export_readable", technology.readExport(releases[1].source).blockers.length === 0);
  denied("legacy_archive_needs_graph_identity", { ...releases[1], providerArchive: { ...releases[1].providerArchive,
    exportSha256: technology.sha256(fs.readFileSync(releases[1].source)) } }, "provider_archive_graph_mismatch");
  fs.writeFileSync(releases[1].source, original);
  console.log(JSON.stringify({ status: "success", check_count: checks.length, checks }, null, 2));
} finally { process.env.PATH = originalPath; fs.rmSync(root, { recursive: true, force: true }); }
