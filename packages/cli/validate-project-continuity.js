#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const technology = require("../project-technology");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(repo, ...args) {
  const run = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr || `git ${args.join(" ")} failed`);
  return run.stdout.trim();
}

function manifest(id) {
  return {
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json",
    format: "mirai-graph", schema_version: "2.0.0", id, aliases: [], title: id,
    scope: "repository", kind: "repository_graph", owner: "fixture-owner",
    profiles: ["project_management", "implementation_control"],
    graph: {
      root: "graph", source_of_truth: ["graph/specs"], objects: ["graph/specs/objects.json"],
      relations: ["graph/specs/relations.json"], schemas: [], generated: ["graph/generated"], raw_sources: ["README.md"],
    },
    imports: [],
    extensions: { "mirai.project_technology": technology.extensionContract() },
  };
}

function createRepo(root, name, withGit = true) {
  const repo = path.join(root, name); fs.mkdirSync(repo, { recursive: true });
  writeJson(path.join(repo, "graph.json"), manifest(name));
  writeJson(path.join(repo, "graph/specs/objects.json"), [{
    id: "goal.fixture.delivery", kind: "goal", title: "Deliver fixture", summary: "Complete a safe fixture task",
    readiness: "accepted", profile: "project_management", source_refs: ["README.md"],
  }]);
  writeJson(path.join(repo, "graph/specs/relations.json"), []);
  fs.writeFileSync(path.join(repo, "README.md"), "# Fixture\nPortable safe context.\n");
  if (withGit) {
    git(repo, "init", "-q"); git(repo, "config", "user.name", "Mirai Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
    git(repo, "add", "."); git(repo, "commit", "-qm", "initial graph");
  }
  return repo;
}

function evidence(task, options = {}) {
  return {
    task_digest: technology.sha256(task, true),
    outcome: options.outcome || `Verified result for ${task}`,
    requirement_refs: options.requirement_refs || ["requirement.fixture.portability"],
    evidence_refs: ["repo://fixture/checks/continuity"],
    checks: [{ id: "check.fixture.continuity", verdict: "pass", evidence_ref: "repo://fixture/checks/continuity" }],
    changed_surfaces: ["src/fixture.js"],
    case_signature: options.case_signature || "case.fixture.portable-work",
    method_candidate: options.method_candidate || null,
    decisions: options.decisions || [],
    source_revision: options.source_revision || null,
  };
}

const checks = [];
function check(id, condition, details = null) {
  checks.push({ id, passed: Boolean(condition), details });
  assert.ok(condition, `${id}: ${JSON.stringify(details)}`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-continuity-"));
const stateRoot = path.join(root, "host-state");
try {
  const repo = createRepo(root, "git-project");
  const before = git(repo, "status", "--porcelain=v1");
  const taskStart = technology.execute("sync", repo, { apply: true, boundary: "task_start", stateRoot });
  check("task_start_is_read_only", taskStart.status === "success" && taskStart.changed === false && git(repo, "status", "--porcelain=v1") === before, taskStart);
  const preview = technology.execute("sync", repo, { apply: false, boundary: "task_complete", continuityEvidence: evidence("preview"), stateRoot });
  check("preview_is_zero_write", preview.status === "preview" && git(repo, "status", "--porcelain=v1") === before, preview);

  const first = technology.execute("sync", repo, { apply: true, boundary: "stage_complete", continuityEvidence: evidence("first", { method_candidate: "Use the verified bounded fixture path." }), stateRoot });
  check("verified_result_is_saved", first.status === "success" && first.changed && first.continuity.saved_refs.length === 2, first);
  check("portable_authority_is_graph_specs", fs.existsSync(path.join(repo, "graph/specs/project-continuity.json")) && first.continuity.authority === "graph/specs");
  check("host_state_is_outside_project", !fs.existsSync(path.join(repo, ".mirai-graph/project-technology/receipts")) && fs.existsSync(stateRoot));
  check("human_projection_is_generated", fs.readFileSync(path.join(repo, "graph/docs/project-context.md"), "utf8").includes("not a source of truth"));
  const objectsAfterFirst = JSON.parse(fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json"), "utf8")).objects;
  check("first_method_is_proposal", objectsAfterFirst.some((item) => item.kind === "lesson" && item.readiness === "proposal"));
  check("architecture_decision_is_not_accepted", technology.execute("sync", repo, {
    apply: true, boundary: "task_complete", stateRoot,
    continuityEvidence: evidence("decision", { decisions: [{ summary: "Replace the project architecture", changes_architecture: true }] }),
  }).status === "success");
  const decisionObjects = JSON.parse(fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json"), "utf8")).objects;
  check("architecture_change_remains_proposal", decisionObjects.some((item) => item.kind === "decision" && item.summary === "Replace the project architecture" && item.readiness === "proposal"));

  const second = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: evidence("second", { method_candidate: "Use the verified bounded fixture path." }), stateRoot });
  check("second_independent_case_is_saved", second.status === "success", second);
  const objectsAfterSecond = JSON.parse(fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json"), "utf8")).objects;
  check("method_promotes_after_two_independent_cases", objectsAfterSecond.some((item) => item.kind === "lesson" && item.readiness === "accepted" && item.supporting_case_ids.length >= 2));

  const beforeRepeat = fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json"));
  const repeated = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: evidence("second", { method_candidate: "Use the verified bounded fixture path." }), stateRoot });
  check("repeat_is_byte_identical", repeated.status === "success" && repeated.changed === false && fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json")).equals(beforeRepeat), repeated);
  check("fresh_receipt_allows_significant_work", technology.continuity.verify(repo, JSON.parse(fs.readFileSync(path.join(repo, "graph.json"), "utf8")), { stateRoot }).status === "success");

  const staleDigest = technology.continuity.graphDigest(repo);
  fs.appendFileSync(path.join(repo, "graph/specs/objects.json"), " ");
  check("stale_continuity_blocks_significant_work", technology.continuity.verify(repo, JSON.parse(fs.readFileSync(path.join(repo, "graph.json"), "utf8")), { stateRoot }).blockers.includes("continuity_stale"));
  const baseObjects = JSON.parse(fs.readFileSync(path.join(repo, "graph/specs/objects.json"), "utf8"));
  baseObjects[0].summary = "Changed concurrently";
  fs.writeFileSync(path.join(repo, "graph/specs/objects.json"), JSON.stringify(baseObjects, null, 2) + "\n");
  const cas = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: evidence("cas"), expectedGraphDigest: staleDigest, stateRoot });
  check("compare_and_swap_conflict_is_safe", cas.status === "blocked" && cas.blockers.includes("continuity_compare_and_swap_conflict"), cas);
  baseObjects[0].summary = "Complete a safe fixture task";
  fs.writeFileSync(path.join(repo, "graph/specs/objects.json"), JSON.stringify(baseObjects, null, 2) + "\n");

  const secret = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: evidence("secret", { outcome: "token=not-a-real-secret-value-123456" }), stateRoot });
  check("secret_is_rejected", secret.status === "blocked" && secret.blockers.includes("continuity_sensitive_or_host_data_forbidden"), secret);
  const privatePath = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: { ...evidence("private"), changed_surfaces: ["source/memory/private.md"] }, stateRoot });
  check("private_projection_is_rejected", privatePath.status === "blocked" && privatePath.blockers.includes("continuity_sensitive_or_host_data_forbidden"), privatePath);
  const failedCheck = technology.execute("sync", repo, { apply: true, boundary: "task_complete", continuityEvidence: { ...evidence("fail"), checks: [{ id: "check.fixture", verdict: "fail", evidence_ref: "repo://fixture/fail" }] }, stateRoot });
  check("unverified_result_is_rejected", failedCheck.status === "blocked" && failedCheck.blockers.includes("continuity_result_not_verified"), failedCheck);

  git(repo, "add", "graph.json", "graph/specs", "graph/docs"); git(repo, "commit", "-qm", "portable continuity records");
  const discovered = technology.context(repo, { phase: "discover", task: "use the verified portable work case" });
  check("new_task_discovers_past_case", discovered.status === "success" && discovered.traversal_receipt.candidates.some((item) => item.id.startsWith("regression_case.continuity.")), discovered.blockers);
  const beforeReadOnly = git(repo, "status", "--porcelain=v1");
  technology.status(repo); technology.context(repo, { phase: "discover", task: "read only project context" });
  check("read_only_operations_write_nothing", git(repo, "status", "--porcelain=v1") === beforeReadOnly);

  const folder = createRepo(root, "shared-folder", false);
  const folderFirst = technology.execute("sync", folder, { apply: true, boundary: "task_complete", continuityEvidence: evidence("folder"), stateRoot });
  check("non_git_folder_supports_continuity", folderFirst.status === "success" && folderFirst.changed, folderFirst);
  const folderRepeat = technology.execute("sync", folder, { apply: true, boundary: "task_complete", continuityEvidence: evidence("folder"), stateRoot });
  check("non_git_repeat_is_idempotent", folderRepeat.status === "success" && folderRepeat.changed === false, folderRepeat);
  const sharedLease = path.join(folder, "graph/.project-technology-continuity.lock");
  fs.writeFileSync(sharedLease, "occupied\n");
  const leaseConflict = technology.execute("sync", folder, { apply: true, boundary: "task_complete", continuityEvidence: evidence("parallel"), stateRoot: path.join(root, "third-installation-state") });
  check("shared_folder_lease_blocks_parallel_writer", leaseConflict.status === "blocked" && leaseConflict.blockers.includes("continuity_lease_conflict"), leaseConflict);
  fs.unlinkSync(sharedLease);
  const folderDiscovery = technology.context(folder, { phase: "discover", task: "portable fixture case" });
  check("non_git_context_is_available", folderDiscovery.status === "success", folderDiscovery.blockers);
  check("same_content_has_stable_digest", technology.continuity.graphDigest(folder) === technology.continuity.graphDigest(folder));

  const otherStateRoot = path.join(root, "other-installation-state");
  const firstInstallContext = technology.context(repo, { phase: "discover", task: "use verified portable work" });
  const secondInstallContext = technology.context(repo, { phase: "discover", task: "use verified portable work", stateRoot: otherStateRoot });
  check("two_installations_get_same_context", firstInstallContext.traversal_receipt.traversal_digest === secondInstallContext.traversal_receipt.traversal_digest);
  check("portable_specs_contain_no_host_paths", !/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/.test(fs.readFileSync(path.join(repo, "graph/specs/project-continuity.json"), "utf8")));
  check("continuity_policy_keeps_contract_version", JSON.parse(fs.readFileSync(path.join(repo, "graph.json"), "utf8")).extensions["mirai.project_technology"].contract_version === "1.0.0");

  process.stdout.write(`${JSON.stringify({ status: "success", checks_passed: checks.length, checks_failed: 0, checks }, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: "fail", checks_passed: checks.filter((item) => item.passed).length, checks_failed: 1, checks, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
