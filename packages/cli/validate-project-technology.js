#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const technology = require("../project-technology");

const TARGET_ID = "fixture.target.accepted_v1";
const SEMANTIC_DIGEST = `sha256:${"2".repeat(64)}`;

function git(repo, ...args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function manifest(id, scope = "repository", profiles = ["project_management", "implementation_control"]) {
  return {
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json",
    format: "mirai-graph", schema_version: "2.0.0", id, aliases: [],
    title: id, scope, kind: `${scope}_graph`, owner: "fixture-owner", profiles,
    graph: {
      root: "graph", source_of_truth: ["graph/specs"], objects: ["graph/specs/index.json"],
      relations: ["graph/specs/relations.json"], schemas: [],
      generated: ["graph/generated"], raw_sources: ["README.md"],
    },
    imports: [],
  };
}

function executionContract() {
  return {
    decision_refs: ["decision.fixture.accepted"],
    goal_binding: { goal_id: "goal.fixture.delivery", done_when_ids: ["done_when.fixture.ready"] },
    requirement_bindings: [{
      requirement_id: "requirement.fixture.runtime",
      acceptance_ids: ["acceptance.fixture.runtime"],
      done_when_ids: ["done_when.fixture.ready"],
    }],
    constraint_ids: ["constraint.fixture.single_owner"],
    non_goal_ids: ["non_goal.fixture.parallel_runtime"],
    deferred_boundary_ids: ["deferred.fixture.publication"],
    allowed_change_scope: [{
      repository_id: "fixture-consumer", owner_id: "runtime", package_id: "fixture/runtime",
      file_patterns: ["packages/runtime/**"], actions: ["modify", "test"],
    }, {
      repository_id: "fixture-consumer-two", owner_id: "runtime", package_id: "fixture/runtime",
      file_patterns: ["packages/runtime/**"], actions: ["modify", "test"],
    }],
    architecture_contract: {
      contract_ref: "contract.fixture.architecture",
      acceptance_ref: "decision.fixture.accepted", architecture_owner_id: "human.fixture.owner", lifecycle: "accepted",
      owner_ids: ["runtime"], component_ids: ["component.fixture.runtime"],
      package_ids: ["fixture/runtime"], capability_ids: ["capability.fixture.runtime"],
      ownership_boundaries: [{
        subject_ref: "capability.fixture.runtime", data_owner: "runtime", access_owner: "runtime",
        lifecycle_owner: "runtime", interface_owner: "runtime", runtime_owner: "runtime",
      }],
      required_relations: ["component.fixture.runtime->capability.fixture.runtime"],
      allowed_relations: [], forbidden_relations: ["capability.fixture.runtime->capability.fixture.legacy"],
      required_dependencies: [], forbidden_dependencies: ["fixture/runtime->fixture/legacy"],
    },
  };
}

function continuityEvidence(repositoryId) {
  return {
    task_digest: technology.sha256(`task:${repositoryId}`, true),
    outcome: `Exact target binding verified for ${repositoryId}`,
    requirement_refs: ["requirement.fixture.runtime"],
    evidence_refs: ["repo://fixture/evidence/project-technology"],
    checks: [{ id: "check.fixture.binding", verdict: "pass", evidence_ref: "repo://fixture/evidence/project-technology" }],
    changed_surfaces: ["graph/specs/project-continuity.json"],
    case_signature: "case.fixture.target-binding",
  };
}

function initRepo(root, name, scope = "repository", profiles) {
  const repo = path.join(root, name); fs.mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q"); git(repo, "config", "user.name", "Mirai Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  writeJson(path.join(repo, "graph.json"), manifest(name, scope, profiles));
  writeJson(path.join(repo, "graph/specs/index.json"), { object_files: [] });
  writeJson(path.join(repo, "graph/specs/relations.json"), []);
  fs.writeFileSync(path.join(repo, "README.md"), `# ${name}\n`);
  git(repo, "add", "."); git(repo, "commit", "-qm", "fixture manifest");
  return repo;
}

function addTarget(repo, contract = executionContract(), lifecycle = "accepted") {
  const relative = `graph/specs/objects/${TARGET_ID}.json`;
  writeJson(path.join(repo, relative), {
    id: TARGET_ID, kind: "knowledge", subtype: "target_outcome", tz_role: "system",
    title: "Accepted fixture target", lifecycle, semantic_digest: SEMANTIC_DIGEST,
    source_refs: ["repo://fixture-provider/graph/specs?rev=fixture"],
    provider_execution_contract: contract,
  });
  writeJson(path.join(repo, "graph/specs/index.json"), { object_files: [`objects/${TARGET_ID}.json`] });
  git(repo, "add", "graph/specs"); git(repo, "commit", "-qm", "accepted target");
  return git(repo, "rev-parse", "HEAD");
}

function initCapsuleProvider(root, name, single = false) {
  const project = require("../../dist/cjs/project");
  const repo = path.join(root, name);
  fs.mkdirSync(repo, { recursive: true });
  project.initProjectCapsule(repo);
  const facade = JSON.parse(fs.readFileSync(path.join(repo, "graph.json"), "utf8"));
  facade.extensions = { "mirai.project_technology": technology.extensionContract() };
  writeJson(path.join(repo, "graph.json"), facade);
  const target = {
    id: TARGET_ID, kind: "knowledge", tz_role: "system", lifecycle: "accepted",
    title: "Synthetic accepted target", semantic_digest: SEMANTIC_DIGEST,
    provider_execution_contract: executionContract(),
  };
  writeJson(path.join(repo, "mirai/graph/objects.json"), single ? target : [target]);
  project.compileProjectCapsule(repo);
  git(repo, "init", "-q"); git(repo, "config", "user.name", "Mirai Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  git(repo, "add", "."); git(repo, "commit", "-qm", "synthetic capsule target");
  return { repo, target, project };
}

const checks = [];
function check(id, condition, details = null) {
  checks.push({ id, passed: Boolean(condition), details });
  assert.ok(condition, `${id}: ${JSON.stringify(details)}`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-project-technology-test-"));
process.env.MIRAI_GRAPH_STATE_ROOT = path.join(root, "host-state");
try {
  const provider = initRepo(root, "fixture-provider", "repository");
  const consumer = initRepo(root, "fixture-consumer", "repository");
  const consumerTwo = initRepo(root, "fixture-consumer-two", "repository");
  const skill = initRepo(root, "fixture-skill", "skill", ["skill_runtime"]);
  const federation = initRepo(root, "fixture-federation", "federation", ["project_management", "implementation_control"]);
  const providerRevision = addTarget(provider);

  const legacyRuntimeRepo = initRepo(root, "legacy-runtime-repository");
  writeJson(path.join(legacyRuntimeRepo, ".mirai-graph/project-technology/inventory.json"), { schema_version: "1.0.0", repository_id: "legacy-runtime-repository", inventory_digest: `sha256:${"0".repeat(64)}`, files: [] });
  const legacyRuntimeEnabled = technology.execute("enable", legacyRuntimeRepo, { apply: true });
  check("project_local_runtime_moves_to_host_state", legacyRuntimeEnabled.status === "success" && legacyRuntimeEnabled.migration_ref.startsWith("host-local://") && fs.existsSync(path.join(legacyRuntimeRepo, ".mirai-graph/project-technology/inventory.json")), legacyRuntimeEnabled);

  const before = fs.readFileSync(path.join(consumer, "graph.json"));
  const preview = technology.execute("enable", consumer, { apply: false });
  check("preview_is_zero_write", preview.status === "preview" && fs.readFileSync(path.join(consumer, "graph.json")).equals(before));
  check("read_only_diagnostics_available", technology.status(consumer).operation_mode === "read_only");

  for (const repo of [provider, consumer, consumerTwo, skill, federation]) {
    const enabled = technology.execute("enable", repo, { apply: true });
    check(`enable_${path.basename(repo)}`, enabled.status === "success", enabled.blockers);
    check(`sync_idempotent_${path.basename(repo)}`, technology.execute("sync", repo, { apply: true }).changed === false);
  }
  check("skill_runtime_uses_same_engine", technology.context(skill, { task: "skill runtime policy" }).operation_id === "mirai.project_technology.context");
  check("federation_scope_uses_same_engine", technology.status(federation).repository_id === "fixture-federation");

  const provided = technology.execute("provide", provider, {
    apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  check("bounded_provider_export", provided.status === "success", provided.blockers);
  const exportPath = path.join(provider, provided.export_ref);
  const exportText = fs.readFileSync(exportPath, "utf8");
  check("export_has_no_private_source", !exportText.includes("source/private") && !exportText.includes("README content"));

  const unboundProvider = initRepo(root, "unbound-provider");
  const unboundRevision = addTarget(unboundProvider);
  technology.execute("enable", unboundProvider, { apply: true });
  const unboundTarget = path.join(unboundProvider, `graph/specs/objects/${TARGET_ID}.json`);
  fs.appendFileSync(unboundTarget, " ");
  const unboundResult = technology.execute("provide", unboundProvider, {
    apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: unboundRevision,
  });
  check("uncommitted_target_cannot_be_exported", unboundResult.status === "fail" && unboundResult.blockers.includes("provider_target_object_not_revision_bound"), unboundResult.blockers);

  const connected = technology.execute("connect", consumer, {
    apply: true, source: exportPath, targetId: TARGET_ID,
    semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  const consumerContinuity = technology.execute("sync", consumer, {
    apply: true, boundary: "task_complete", continuityEvidence: continuityEvidence("fixture-consumer"),
  });
  check("consumer_binding_ready", connected.status === "success" && consumerContinuity.status === "success" && technology.verify(consumer, { significantWork: true }).status === "success", { connect: connected.blockers, continuity: consumerContinuity.blockers });
  const connectedTwo = technology.execute("connect", consumerTwo, {
    apply: true, source: exportPath, targetId: TARGET_ID,
    semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  const consumerTwoContinuity = technology.execute("sync", consumerTwo, {
    apply: true, boundary: "task_complete", continuityEvidence: continuityEvidence("fixture-consumer-two"),
  });
  check("second_consumer_binding_ready", connectedTwo.status === "success" && consumerTwoContinuity.status === "success" && technology.verify(consumerTwo, { significantWork: true }).status === "success", { connect: connectedTwo.blockers, continuity: consumerTwoContinuity.blockers });
  const repeated = technology.execute("connect", consumer, {
    apply: true, source: exportPath, targetId: TARGET_ID,
    semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  check("repeated_connect_byte_identical", repeated.status === "success" && repeated.changed === false, repeated.blockers);

  fs.appendFileSync(path.join(provider, "README.md"), "forward revision\n");
  git(provider, "add", "README.md"); git(provider, "commit", "-qm", "forward provider revision");
  const nextRevision = git(provider, "rev-parse", "HEAD");
  const nextProvided = technology.execute("provide", provider, {
    apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: nextRevision,
  });
  const refresh = technology.execute("connect", consumer, {
    apply: true, refreshBinding: true, source: path.join(provider, nextProvided.export_ref),
    targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: nextRevision,
  });
  check("forward_refresh_preserves_contract", refresh.status === "success" && refresh.changed, refresh.blockers);
  const refreshAgain = technology.execute("connect", consumer, {
    apply: true, refreshBinding: true, source: path.join(provider, nextProvided.export_ref),
    targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: nextRevision,
  });
  check("refresh_is_idempotent", refreshAgain.status === "success" && refreshAgain.changed === false, refreshAgain.blockers);

  const conflictingProvider = path.join(root, "conflicting-provider");
  git(root, "clone", "-q", provider, conflictingProvider);
  const conflictingPayload = JSON.parse(fs.readFileSync(path.join(provider, nextProvided.export_ref), "utf8"));
  conflictingPayload.non_goal_ids = ["non_goal.fixture.other_runtime"];
  const normalizedConflict = technology.normalizeExecutionContract(conflictingPayload).contract;
  conflictingPayload.execution_contract_digest = technology.sha256(technology.canonicalBytes(normalizedConflict));
  const conflictingExport = path.join(conflictingProvider, "graph/generated/project-technology/conflicting-target-export.json");
  writeJson(conflictingExport, conflictingPayload);
  const providerConflict = technology.execute("connect", consumer, {
    apply: true, source: conflictingExport, targetId: TARGET_ID,
    semanticDigest: SEMANTIC_DIGEST, providerRevision: nextRevision,
  });
  check("two_provider_conflict_fails_closed", providerConflict.status === "fail" && providerConflict.blockers.includes("target_provider_conflict"), providerConflict.blockers);

  const downgrade = technology.execute("connect", consumer, {
    apply: true, refreshBinding: true, source: exportPath,
    targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  check("provider_downgrade_fails_closed", downgrade.status === "fail" && downgrade.blockers.includes("provider_revision_not_forward"), downgrade.blockers);

  fs.appendFileSync(path.join(provider, "README.md"), "provider moved without export\n");
  git(provider, "add", "README.md"); git(provider, "commit", "-qm", "provider moved past export");
  const staleProvider = technology.execute("connect", consumer, {
    apply: true, refreshBinding: true, source: path.join(provider, nextProvided.export_ref),
    targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: nextRevision,
  });
  check("stale_provider_export_fails_closed", staleProvider.status === "fail" && staleProvider.blockers.includes("provider_revision_does_not_match_head"), staleProvider.blockers);

  const wrongTarget = technology.execute("connect", initRepo(root, "wrong-target"), {
    apply: true, source: exportPath, targetId: "fixture.target.other",
    semanticDigest: SEMANTIC_DIGEST, providerRevision,
  });
  check("target_mismatch_fails_closed", wrongTarget.status === "fail" && wrongTarget.blockers.includes("target_id_mismatch"), wrongTarget.blockers);
  const wrongDigest = technology.execute("connect", initRepo(root, "wrong-digest"), {
    apply: true, source: exportPath, targetId: TARGET_ID,
    semanticDigest: `sha256:${"3".repeat(64)}`, providerRevision,
  });
  check("digest_mismatch_fails_closed", wrongDigest.status === "fail" && wrongDigest.blockers.includes("semantic_digest_mismatch"), wrongDigest.blockers);

  const tampered = path.join(root, "tampered.json");
  const tamperedPayload = JSON.parse(exportText); tamperedPayload.non_goal_ids = ["non_goal.fixture.tampered"];
  writeJson(tampered, tamperedPayload);
  check("tampered_contract_fails_closed", technology.readExport(tampered).blockers.includes("provider_execution_contract_digest_mismatch"));

  const incomplete = executionContract(); incomplete.requirement_bindings = [];
  check("incomplete_contract_fails_closed", technology.normalizeExecutionContract(incomplete).blockers.includes("provider_contract_requirement_bindings_empty"));
  const cycle = executionContract(); cycle.architecture_contract.required_dependencies = ["aa->bb", "bb->aa"];
  check("dependency_cycle_fails_closed", technology.normalizeExecutionContract(cycle).blockers.includes("provider_architecture_dependency_cycle"));
  check("blocked_significant_work_keeps_status", technology.verify(skill, { significantWork: true }).status === "blocked" && technology.status(skill).operation_mode === "read_only");

  const disabled = technology.execute("disable", skill, { apply: true });
  check("disabled_state_fails_closed", disabled.status === "success" && technology.verify(skill, { significantWork: true }).status === "blocked");

  const largeProvider = initRepo(root, "large-provider");
  addTarget(largeProvider);
  const emptyBlob = spawnSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: largeProvider, input: "", encoding: "utf8",
  }).stdout.trim();
  const padding = "x".repeat(190);
  const indexInfo = Array.from({ length: 5200 }, (_, index) =>
    `100644 ${emptyBlob}\tarchive/${String(index).padStart(5, "0")}-${padding}.txt\n`
  ).join("");
  const indexed = spawnSync("git", ["update-index", "--index-info"], {
    cwd: largeProvider, input: indexInfo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  check("large_repository_fixture_created", indexed.status === 0, indexed.stderr);
  git(largeProvider, "commit", "-qm", "large tracked index");
  const largeRevision = git(largeProvider, "rev-parse", "HEAD");
  check("large_repository_enable", technology.execute("enable", largeProvider, { apply: true }).status === "success");
  const largeProvided = technology.execute("provide", largeProvider, {
    apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: largeRevision,
  });
  check("large_repository_target_is_not_lost_to_process_buffer", largeProvided.status === "success", largeProvided.blockers);

  const cli = spawnSync(process.execPath, [path.join(__dirname, "mirai-graph.js"), "technology", "explain", federation], { encoding: "utf8" });
  const cliResult = JSON.parse(cli.stdout);
  check("unified_cli_contract", cli.status === 0 && cliResult.operation_id === "mirai.project_technology.explain" && cliResult.operation_mode === "read_only");

  const cliFromCwd = spawnSync(process.execPath, [path.join(__dirname, "mirai-graph.js"), "technology", "status"], {
    cwd: federation, encoding: "utf8",
  });
  const cliFromCwdResult = JSON.parse(cliFromCwd.stdout);
  check("unified_cli_defaults_to_caller_cwd", cliFromCwd.status === 0 && cliFromCwdResult.repository_id === "fixture-federation", cliFromCwdResult);

  const cliDot = spawnSync(process.execPath, [path.join(__dirname, "mirai-graph.js"), "technology", "status", "."], {
    cwd: federation, encoding: "utf8",
  });
  const cliDotResult = JSON.parse(cliDot.stdout);
  check("unified_cli_resolves_relative_repo_from_caller_cwd", cliDot.status === 0 && cliDotResult.repository_id === "fixture-federation", cliDotResult);

  for (const single of [false, true]) {
    const { repo, project } = initCapsuleProvider(root, `capsule-${single ? "single" : "array"}`, single);
    const capsuleOptions = { apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: git(repo, "rev-parse", "HEAD") };
    const baseline = git(repo, "status", "--porcelain=v1");
    const first = technology.execute("provide", repo, capsuleOptions);
    check(`capsule_${single ? "single" : "array"}_target_exports`, first.status === "success" && first.export_ref === ".mirai/evidence/project-technology/target-provider-export.json", first.blockers);
    check("capsule_export_preserves_canonical_files_and_lock", baseline === git(repo, "status", "--porcelain=v1") && project.validateProjectCapsule(repo).valid && !fs.existsSync(path.join(repo, "graph")));
    check("capsule_export_is_idempotent", technology.execute("provide", repo, capsuleOptions).changed === false);
    const capsuleConsumer = initRepo(root, `capsule-consumer-${single}`);
    technology.execute("enable", capsuleConsumer, { apply: true });
    const imported = technology.execute("connect", capsuleConsumer, { ...capsuleOptions, source: path.join(repo, first.export_ref) });
    check("capsule_export_connects_with_exact_revision", imported.status === "success", imported.blockers);
    const forged = JSON.parse(fs.readFileSync(path.join(repo, first.export_ref), "utf8"));
    forged.non_goal_ids = ["non_goal.fixture.forged"];
    forged.execution_contract_digest = technology.sha256(technology.canonicalBytes(technology.normalizeExecutionContract(forged).contract));
    const forgedPath = path.join(repo, ".mirai/evidence/project-technology/forged-export.json");
    writeJson(forgedPath, forged);
    const forgedImport = technology.execute("connect", capsuleConsumer, { ...capsuleOptions, source: forgedPath });
    check("capsule_export_cannot_replace_canonical_contract", forgedImport.status === "fail" && forgedImport.blockers.includes("provider_export_does_not_match_capsule_target"), forgedImport.blockers);
  }

  const capsuleNegativeCases = [
    ["missing_lock", ({ repo }) => fs.unlinkSync(path.join(repo, "mirai/manifest.lock.json")), "provider_capsule_lock_or_start_invalid"],
    ["forged_lock", ({ repo }) => writeJson(path.join(repo, "mirai/manifest.lock.json"), { digest: SEMANTIC_DIGEST }), "provider_capsule_lock_or_start_invalid"],
    ["stale_start", ({ repo }) => fs.appendFileSync(path.join(repo, "mirai/START.md"), "tampered\n"), "provider_capsule_lock_or_start_invalid"],
    ["stale_graph", ({ repo, target }) => writeJson(path.join(repo, "mirai/graph/objects.json"), [{ ...target, title: "changed" }]), "provider_capsule_lock_or_start_invalid"],
    ["dirty_target", ({ repo, target, project }) => { writeJson(path.join(repo, "mirai/graph/objects.json"), [{ ...target, title: "changed" }]); project.compileProjectCapsule(repo); }, "provider_target_object_not_revision_bound"],
    ["untracked_target", ({ repo }) => git(repo, "rm", "--cached", "mirai/graph/objects.json"), "provider_target_object_not_revision_bound"],
    ["duplicate_target", ({ repo, target, project }) => { writeJson(path.join(repo, "mirai/graph/objects.json"), [target, target]); project.compileProjectCapsule(repo); git(repo, "add", "."); git(repo, "commit", "-qm", "duplicate fixture"); }, "provider_capsule_duplicate_identity"],
    ["reviewed_not_accepted", ({ repo, target, project }) => { writeJson(path.join(repo, "mirai/graph/objects.json"), [{ ...target, lifecycle: "reviewed" }]); project.compileProjectCapsule(repo); git(repo, "add", "."); git(repo, "commit", "-qm", "reviewed fixture"); }, "provider_target_not_accepted"],
    ["facade_redirect", ({ repo }) => { const facade = JSON.parse(fs.readFileSync(path.join(repo, "graph.json"))); facade.graph.objects = ["graph/other.json"]; writeJson(path.join(repo, "graph.json"), facade); }, "provider_capsule_facade_mismatch"],
    ["target_symlink", ({ repo }) => { const file = path.join(repo, "mirai/graph/objects.json"); fs.unlinkSync(file); fs.symlinkSync(path.join(provider, "README.md"), file); }, "provider_capsule_invalid"],
    ["export_parent_symlink", ({ repo }) => fs.symlinkSync(root, path.join(repo, ".mirai"), "dir"), "provider_capsule_lock_or_start_invalid"],
    ["export_dangling_symlink", ({ repo }) => fs.symlinkSync(path.join(root, "absent"), path.join(repo, ".mirai"), "dir"), "provider_capsule_lock_or_start_invalid"],
  ];
  for (const [id, mutate, expected] of capsuleNegativeCases) {
    const fixture = initCapsuleProvider(root, `capsule-negative-${id}`);
    mutate(fixture);
    const baseline = git(fixture.repo, "status", "--porcelain=v1");
    const denied = technology.execute("provide", fixture.repo, { apply: true, targetId: TARGET_ID, semanticDigest: SEMANTIC_DIGEST, providerRevision: git(fixture.repo, "rev-parse", "HEAD") });
    check(`capsule_rejects_${id}`, denied.status === "fail" && denied.blockers.includes(expected), denied.blockers);
    check(`capsule_rejection_${id}_writes_nothing`, git(fixture.repo, "status", "--porcelain=v1") === baseline && !fs.existsSync(path.join(fixture.repo, "graph")));
  }

  process.stdout.write(`${JSON.stringify({ status: "success", checks_passed: checks.length, checks_failed: 0, checks }, null, 2)}\n`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
