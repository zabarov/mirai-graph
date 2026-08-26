#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const technology = require("../project-technology");
const cli = path.join(__dirname, "project-technology.js");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(repo, ...args) {
  const completed = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (completed.status !== 0) throw new Error(completed.stderr || `git ${args.join(" ")} failed`);
  return completed.stdout.trim();
}

function object(id, kind, title, extra = {}) {
  return {
    id, kind, title, summary: `${title} summary`, readiness: "accepted",
    evidence: [], profile: "project_management", expansion_policy: "conditional", ...extra,
  };
}

function relation(id, type, source, target, readiness = "accepted") {
  return { id, type, source, target, readiness, evidence: [], profile: "project_management" };
}

function createFixture(root, name, scope = "repository", mutation = null) {
  const repo = path.join(root, name); fs.mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q"); git(repo, "config", "user.name", "Mirai Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
  const objects = [
    object("capability.delivery", "capability", "Deliver service", { aliases: ["build application"], owner: "role.delivery", expansion_policy: "expandable" }),
    object("process.delivery", "process", "Delivery process", { owner: "role.delivery", expansion_policy: "expandable" }),
    object("resource.delivery_guide", "resource", "Delivery guide", { owner: "role.delivery", expansion_policy: "expandable", source_refs: ["docs/delivery.md"] }),
    object("constraint.safety", "constraint", "Safety boundary", { owner: "role.safety", expansion_policy: "expandable", source_refs: ["docs/safety.md"] }),
    object("check.delivery", "check", "Delivery validation", { owner: "role.quality", expansion_policy: "terminal", source_refs: ["docs/check.md"] }),
    object("resource.shared", "resource", "Shared source", { owner: "role.delivery", expansion_policy: "terminal", source_refs: ["docs/shared.md"] }),
    object("capability.optional", "capability", "Optional reporting", { owner: "role.delivery", expansion_policy: "terminal", source_refs: ["docs/optional.md"] }),
    object("capability.unrelated", "capability", "Unrelated payroll", { owner: "role.finance", expansion_policy: "terminal", source_refs: ["docs/unrelated.md"] }),
  ];
  const relations = [
    relation("relation.delivery_contains_process", "contains", "capability.delivery", "process.delivery"),
    relation("relation.process_contains_guide", "contains", "process.delivery", "resource.delivery_guide"),
    relation("relation.process_requires_safety", "governed_by", "process.delivery", "constraint.safety"),
    relation("relation.process_validated", "validated_by", "process.delivery", "check.delivery"),
    relation("relation.guide_shared", "documented_by", "resource.delivery_guide", "resource.shared"),
    relation("relation.safety_shared", "documented_by", "constraint.safety", "resource.shared"),
    relation("relation.delivery_optional", "contains", "capability.delivery", "capability.optional"),
  ];
  if (mutation) mutation(objects, relations);
  const manifest = {
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json", format: "mirai-graph", schema_version: "2.0.0",
    id: name, aliases: [], title: name, scope, kind: `${scope}_graph`, owner: "fixture-owner", profiles: ["project_management", "implementation_control"],
    graph: { root: "graph", source_of_truth: ["graph/specs"], objects: ["graph/specs/objects.json"], relations: ["graph/specs/relations.json"], schemas: [], generated: ["graph/generated"], raw_sources: ["docs"] },
    imports: [], extensions: { "mirai.project_technology": { contract_version: "1.0.0", enabled: true, context_policy: "task_scoped", source_boundary: "hybrid_sot" } },
  };
  if (scope === "package") { manifest.version = "1.0.0"; manifest.conformance_level = "level_2"; }
  writeJson(path.join(repo, "graph.json"), manifest);
  writeJson(path.join(repo, "graph/specs/objects.json"), objects);
  writeJson(path.join(repo, "graph/specs/relations.json"), relations);
  for (const name of ["delivery", "safety", "check", "shared", "optional", "unrelated"]) {
    fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repo, `docs/${name}.md`), `# ${name}\nSafe fixture source.\n`);
  }
  git(repo, "add", "."); git(repo, "commit", "-qm", "context traversal fixture");
  return repo;
}

function createLegacyFixture(root) {
  const repo = createFixture(root, "legacy-skill-graph", "skill");
  const objectFile = path.join(repo, "graph/specs/objects.json");
  const relationFile = path.join(repo, "graph/specs/relations.json");
  const objects = JSON.parse(fs.readFileSync(objectFile, "utf8")).map((item) => {
    const legacy = { ...item, type: item.kind };
    delete legacy.kind;
    delete legacy.readiness;
    return legacy;
  });
  const aliases = {
    contains: "implements",
    governed_by: "governed_by",
    validated_by: "validates",
    documented_by: "evidenced_by",
  };
  const relations = JSON.parse(fs.readFileSync(relationFile, "utf8")).map((item) => {
    const legacyType = aliases[item.type] || item.type;
    const reverse = item.type === "validated_by";
    const legacy = {
      ...item,
      relation_type: legacyType,
      from: reverse ? item.target : item.source,
      to: reverse ? item.source : item.target,
      status: item.readiness,
    };
    delete legacy.type;
    delete legacy.source;
    delete legacy.target;
    delete legacy.readiness;
    return legacy;
  });
  writeJson(objectFile, objects);
  writeJson(relationFile, relations);
  git(repo, "add", "."); git(repo, "commit", "-qm", "legacy graph aliases");
  return repo;
}

function selection(receipt) {
  return {
    selector: "ai", task_digest: receipt.task.digest, graph_digest: receipt.graph.digest,
    result_owner_id: "role.delivery",
    selected: [
      { id: "capability.delivery", reason: "matches requested delivery outcome", confidence: 0.98 },
      { id: "process.delivery", reason: "implements the outcome", confidence: 0.96 },
      { id: "resource.delivery_guide", reason: "authoritative terminal guide", confidence: 0.94 },
      { id: "resource.shared", reason: "shared source for selected path", confidence: 0.9 },
    ],
    rejected: [{ id: "capability.optional", reason: "reporting is outside the requested outcome" }],
  };
}

const checks = [];
function check(id, condition, details = null) {
  checks.push({ id, passed: Boolean(condition), details });
  assert.ok(condition, `${id}: ${JSON.stringify(details)}`);
}

function runCli(args) {
  const completed = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const stdout = String(completed.stdout || "").replace(/^\uFEFF/, "").trim();
  let output = null; let parseError = null;
  try { output = JSON.parse(stdout); } catch (error) { parseError = error.message; }
  return { status: completed.status, output, stderr: completed.stderr, stdout_length: stdout.length, parse_error: parseError };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-context-traversal-"));
try {
  const repo = createFixture(root, "software-project");
  for (const [name, scope] of [["research-program", "domain"], ["organization", "workspace"], ["technology-platform", "package"], ["skill-like-repository", "skill"], ["multi-repository-system", "federation"]]) {
    const fixture = createFixture(root, name, scope);
    const discovered = technology.discoverContext(fixture, "deliver application safely", { maxCandidates: 2 });
    check(`universal_scope_${scope}`, discovered.status === "success" && discovered.traversal_receipt.repository_id === name, discovered.blockers);
  }

  const legacyRepo = createLegacyFixture(root);
  let legacyReceipt = technology.discoverContext(legacyRepo, "build application delivery safely").traversal_receipt;
  for (const ids of [["capability.delivery"], ["process.delivery"], ["resource.delivery_guide", "constraint.safety", "check.delivery"], ["resource.shared"]]) {
    legacyReceipt = technology.expandContext(legacyRepo, legacyReceipt, ids, { selector: "ai", reason: "legacy graph compatibility" }).traversal_receipt;
  }
  const legacyCompiled = technology.compileContext(legacyRepo, legacyReceipt, selection(legacyReceipt));
  check("legacy_graph_2_aliases_compile", legacyCompiled.status === "ready", legacyCompiled.blockers);
  check("legacy_relation_semantics_preserved", legacyCompiled.context_pack.required_closure.object_ids.includes("constraint.safety") && legacyCompiled.context_pack.validators.includes("check.delivery"), legacyCompiled.context_pack);
  const legacyReadinessRepo = createFixture(root, "legacy-readiness", "skill", (objects) => {
    objects.find((item) => item.id === "capability.delivery").readiness = "R3_structured";
  });
  let legacyReadinessReceipt = technology.discoverContext(legacyReadinessRepo, "build application delivery safely").traversal_receipt;
  for (const ids of [["capability.delivery"], ["process.delivery"], ["resource.delivery_guide", "constraint.safety", "check.delivery"], ["resource.shared"]]) {
    legacyReadinessReceipt = technology.expandContext(legacyReadinessRepo, legacyReadinessReceipt, ids).traversal_receipt;
  }
  check("legacy_ready_level_compiles", technology.compileContext(legacyReadinessRepo, legacyReadinessReceipt, selection(legacyReadinessReceipt)).status === "ready");
  const legacyDraftRepo = createFixture(root, "legacy-draft-readiness", "skill", (objects) => {
    objects.find((item) => item.id === "capability.delivery").readiness = "R2_seed";
  });
  const legacyDraftReceipt = technology.discoverContext(legacyDraftRepo, "build application delivery safely").traversal_receipt;
  check("legacy_draft_level_remains_blocked", technology.compileContext(legacyDraftRepo, legacyDraftReceipt, selection(legacyDraftReceipt)).status !== "ready");

  const before = git(repo, "status", "--porcelain=v1");
  const discovered = technology.discoverContext(repo, "build application delivery safely", { maxCandidates: 2 });
  check("discover_is_bounded", discovered.status === "success" && discovered.traversal_receipt.candidates.length <= 2, discovered);
  check("discover_returns_top_level_candidate", discovered.traversal_receipt.candidates[0].id === "capability.delivery", discovered.traversal_receipt.candidates);
  check("runtime_passport_is_machine_readable", discovered.traversal_receipt.nodes[0].expandable === true && Array.isArray(discovered.traversal_receipt.nodes[0].child_kinds));

  const first = technology.expandContext(repo, discovered.traversal_receipt, ["capability.delivery"], { selector: "ai", reason: "delivery branch" });
  check("first_expand_reveals_children", first.traversal_receipt.visited_ids.includes("process.delivery") && first.traversal_receipt.visited_ids.includes("capability.optional"));
  const second = technology.expandContext(repo, first.traversal_receipt, ["process.delivery"], { selector: "ai", reason: "delivery process" });
  check("expand_reaches_arbitrary_depth", second.traversal_receipt.visited_ids.includes("resource.delivery_guide"));
  const third = technology.expandContext(repo, second.traversal_receipt, ["resource.delivery_guide", "constraint.safety", "check.delivery"], { selector: "ai", reason: "required leaves" });
  const fourth = technology.expandContext(repo, third.traversal_receipt, ["resource.shared"], { selector: "ai", reason: "shared source" });
  check("terminal_node_stops", !fourth.traversal_receipt.frontier_ids.includes("resource.shared"));

  const batchFirst = technology.expandContext(repo, discovered.traversal_receipt, ["capability.delivery"], { selector: "ai", reason: "delivery branch" });
  const batchSecond = technology.expandContext(repo, batchFirst.traversal_receipt, ["process.delivery"], { selector: "ai", reason: "delivery process" });
  const batchLeaves = technology.expandContext(repo, batchSecond.traversal_receipt, ["check.delivery", "constraint.safety", "resource.delivery_guide"], { selector: "ai", reason: "required leaves" });
  const batch = technology.expandContext(repo, batchLeaves.traversal_receipt, ["resource.shared"], { selector: "ai", reason: "shared source" });
  let sequential = batchSecond;
  for (const id of ["check.delivery", "constraint.safety", "resource.delivery_guide"]) sequential = technology.expandContext(repo, sequential.traversal_receipt, [id], { selector: "ai", reason: "required leaves" });
  sequential = technology.expandContext(repo, sequential.traversal_receipt, ["resource.shared"], { selector: "ai", reason: "shared source" });
  check("batch_and_sequential_expand_match", batch.traversal_receipt.traversal_digest === sequential.traversal_receipt.traversal_digest, { batch: batch.traversal_receipt.traversal_digest, sequential: sequential.traversal_receipt.traversal_digest });

  const compiled = technology.compileContext(repo, fourth.traversal_receipt, selection(fourth.traversal_receipt));
  check("compile_ready", compiled.status === "ready", compiled.blockers);
  check("required_dependencies_are_automatic", compiled.context_pack.required_closure.object_ids.includes("constraint.safety") && compiled.context_pack.required_closure.object_ids.includes("check.delivery"));
  const selectionWithoutSources = selection(fourth.traversal_receipt);
  selectionWithoutSources.selected = selectionWithoutSources.selected.filter((item) => !item.id.startsWith("resource."));
  const compiledWithSourceClosure = technology.compileContext(repo, fourth.traversal_receipt, selectionWithoutSources);
  check("declared_sources_are_automatic", compiledWithSourceClosure.status === "ready" && compiledWithSourceClosure.context_pack.required_closure.object_ids.includes("resource.delivery_guide") && compiledWithSourceClosure.context_pack.required_closure.object_ids.includes("resource.shared"), { blockers: compiledWithSourceClosure.blockers, completeness: compiledWithSourceClosure.context_pack.completeness, closure: compiledWithSourceClosure.context_pack.required_closure.object_ids });
  check("optional_branch_has_reason", compiled.context_pack.omissions.some((item) => item.id === "capability.optional"));
  check("shared_source_is_not_duplicated", compiled.context_pack.terminal_sources.filter((item) => item.ref === "docs/shared.md").length === 1, compiled.context_pack.terminal_sources);
  const compiledAgain = technology.compileContext(repo, fourth.traversal_receipt, selection(fourth.traversal_receipt));
  check("compile_is_byte_identical", JSON.stringify(compiled) === JSON.stringify(compiledAgain));

  const usage = compiled.context_pack.terminal_sources.map((source) => ({
    context_pack_digest: compiled.context_pack.context_pack_digest,
    source: source.ref,
    applied_rule: compiled.context_pack.processes[0] || `apply ${source.node_ids[0]}`,
    process: compiled.context_pack.processes[0] || null,
    decision: "follow the accepted bounded path",
    surface: "fixture surface",
    validator: compiled.context_pack.validators[0] || "check.delivery",
    outcome: "verified",
  }));
  check("usage_verification_passes", technology.verifyContext(repo, compiled.context_pack, usage).status === "success");
  check("loading_is_not_application", technology.verifyContext(repo, compiled.context_pack, []).status === "blocked");
  const wrongPackUsage = usage.map((item) => ({ ...item, context_pack_digest: `sha256:${"0".repeat(64)}` }));
  check("different_pack_usage_is_blocked", technology.verifyContext(repo, compiled.context_pack, wrongPackUsage).blockers.includes("usage_evidence_context_pack_mismatch"));

  const incomplete = technology.compileContext(repo, first.traversal_receipt, selection(first.traversal_receipt));
  check("incomplete_closure_never_ready", incomplete.status !== "ready");
  const tinyBudget = technology.compileContext(repo, fourth.traversal_receipt, selection(fourth.traversal_receipt), { contextBudget: 100 });
  check("budget_never_drops_required_sources", tinyBudget.status === "blocked" && tinyBudget.context_pack.required_closure.object_ids.length === compiled.context_pack.required_closure.object_ids.length);

  const mutations = {
    required_cycle(objects, relations) { relations.push(relation("relation.safety_cycle", "requires", "constraint.safety", "process.delivery")); },
    stale(objects) { objects.find((item) => item.id === "constraint.safety").readiness = "stale"; },
    blocked(objects) { objects.find((item) => item.id === "constraint.safety").readiness = "blocked"; },
    deprecated(objects) { objects.find((item) => item.id === "constraint.safety").readiness = "deprecated"; },
    conflict(objects, relations) { relations.push(relation("relation.process_conflict", "conflicts_with", "process.delivery", "constraint.safety")); },
    policy_mismatch(objects) { objects.find((item) => item.id === "process.delivery").expansion_policy = "terminal"; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const fixture = createFixture(root, name, "repository", mutate);
    let receipt = technology.discoverContext(fixture, "build application delivery safely").traversal_receipt;
    for (const ids of [["capability.delivery"], ["process.delivery"], ["resource.delivery_guide", "constraint.safety", "check.delivery"], ["resource.shared"]]) receipt = technology.expandContext(fixture, receipt, ids).traversal_receipt;
    const outcome = technology.compileContext(fixture, receipt, selection(receipt));
    check(`${name}_blocks_ready`, outcome.status !== "ready", outcome.blockers);
  }

  const tamperedReceipt = JSON.parse(JSON.stringify(fourth.traversal_receipt)); tamperedReceipt.graph.digest = `sha256:${"1".repeat(64)}`;
  check("tampered_receipt_is_blocked", technology.expandContext(repo, tamperedReceipt, ["resource.shared"]).status === "blocked");
  const tamperedPack = JSON.parse(JSON.stringify(compiled.context_pack)); tamperedPack.validators = [];
  check("tampered_pack_is_blocked", technology.verifyContext(repo, tamperedPack, usage).status === "blocked");
  const secretUsage = [{ ...usage[0], decision: `Bearer ${"github"}_${"pat"}_not-a-real-token-123456789` }];
  check("secret_like_usage_is_blocked", technology.verifyContext(repo, compiled.context_pack, secretUsage).blockers.includes("usage_evidence_contains_sensitive_data"));
  fs.appendFileSync(path.join(repo, "docs/delivery.md"), "tampered\n");
  check("changed_source_digest_is_blocked", technology.verifyContext(repo, compiled.context_pack, usage).blockers.includes("context_pack_source_revision_or_digest_mismatch"));
  git(repo, "checkout", "--", "docs/delivery.md");

  const unmatched = technology.discoverContext(repo, "zzzz semantic request without lexical overlap", { maxCandidates: 2 });
  check("unmatched_task_still_returns_bounded_choices", unmatched.status === "success" && unmatched.traversal_receipt.candidates.length > 0 && unmatched.traversal_receipt.warnings.includes("no_lexical_match_candidates_unranked"));

  const privateFixture = createFixture(root, "private-source", "repository", (objects) => {
    objects.find((item) => item.id === "resource.delivery_guide").source_refs.push("source/private/customer.txt");
  });
  fs.mkdirSync(path.join(privateFixture, "source/private"), { recursive: true });
  fs.writeFileSync(path.join(privateFixture, "source/private/customer.txt"), "private customer content must not escape\n");
  let privateReceipt = technology.discoverContext(privateFixture, "build application delivery safely").traversal_receipt;
  for (const ids of [["capability.delivery"], ["process.delivery"], ["resource.delivery_guide", "constraint.safety", "check.delivery"], ["resource.shared"]]) privateReceipt = technology.expandContext(privateFixture, privateReceipt, ids).traversal_receipt;
  const privateText = JSON.stringify(privateReceipt);
  check("private_source_content_never_escapes", !privateText.includes("customer.txt") && !privateText.includes("private customer content"));
  const privateCompile = technology.compileContext(privateFixture, privateReceipt, selection(privateReceipt));
  check("unsafe_private_reference_fails_closed", privateCompile.status === "blocked" && privateCompile.blockers.includes("unsafe_source_reference_omitted"), privateCompile.blockers);

  const receiptFile = path.join(root, "receipt.json");
  const selectionFile = path.join(root, "selection.json");
  const packetFile = path.join(root, "packet.json");
  const evidenceFile = path.join(root, "evidence.json");
  writeJson(receiptFile, fourth.traversal_receipt); writeJson(selectionFile, selection(fourth.traversal_receipt));
  writeJson(packetFile, compiled.context_pack); writeJson(evidenceFile, usage);
  const cliDiscover = runCli(["context", repo, "--phase", "discover", "--task", "build application delivery safely"]);
  check("cli_discover_uses_public_protocol", cliDiscover.status === 0 && cliDiscover.output?.operation_id.endsWith(".discover"), cliDiscover);
  const cliExpand = runCli(["context", repo, "--phase", "expand", "--input", receiptFile, "--select", "resource.shared"]);
  check("cli_expand_uses_public_protocol", cliExpand.status === 0 && cliExpand.output?.operation_id.endsWith(".expand"), cliExpand);
  const cliCompile = runCli(["context", repo, "--phase", "compile", "--input", receiptFile, "--selection", selectionFile]);
  check("cli_compile_uses_public_protocol", cliCompile.status === 0 && cliCompile.output?.status === "ready", cliCompile);
  const cliVerify = runCli(["context", repo, "--phase", "verify", "--packet", packetFile, "--evidence", evidenceFile]);
  check("cli_verify_uses_public_protocol", cliVerify.status === 0 && cliVerify.output?.status === "success", cliVerify);

  const legacy = technology.context(repo, { task: "build application delivery safely" });
  check("legacy_context_command_still_works", legacy.operation_id === "mirai.project_technology.context" && legacy.operation_mode === "read_only");
  check("all_context_operations_are_zero_write", git(repo, "status", "--porcelain=v1") === before);

  process.stdout.write(`${JSON.stringify({ status: "success", checks_passed: checks.length, checks_failed: 0, checks }, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: "fail", checks_passed: checks.filter((item) => item.passed).length, checks_failed: 1, checks, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
