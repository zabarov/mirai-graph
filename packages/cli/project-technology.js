#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { execute } = require("../project-technology");

function usage() {
  console.error("Usage: mirai-graph technology <operation> [repository] [options]");
  console.error("Read-only: explain | status | plan | verify | context");
  console.error("Transactional: enable | sync | connect | disconnect | provide | disable | repair");
  console.error("Options: --apply --task <text> --source <file> --target-id <id>");
  console.error("         --semantic-digest <sha256:...> --provider-revision <sha>");
  console.error("         --refresh-binding --significant-work --max-objects <count>");
  console.error("Archive connect: --provider-archive-trust <verified-release-anchor.json>");
  console.error("Continuity: sync --boundary task_start|stage_complete|task_complete [--evidence <json>] [--expected-graph-digest <sha256:...>]");
  console.error("            verify --significant-work [--receipt-digest <sha256:...>]");
  console.error("Context: --phase discover --task <text>");
  console.error("         --phase expand --input <receipt.json> --select <id> [--select <id>]");
  console.error("         --phase compile --input <receipt.json> --selection <selection.json>");
  console.error("         --phase verify --packet <context-pack.json> --evidence <usage-evidence.json>");
  console.error("Artifacts: artifact inspect <repo> --input <path>");
  console.error("           artifact release <repo> --input <path> --matter-id <id> --direction inbound|internal|outbound [--parent-release <id>] [--client-note <text>] [--create-export] [--apply]");
  console.error("           artifact compare <repo> --matter-id <id> --base-release <id> --target-release <id>");
  console.error("           artifact verify <repo> --matter-id <id> --release-id <id>");
  console.error("Courses: course compile <repo> --technology <file> [--scenario <id>] [--audience <id>]");
  console.error("         course verify <repo> --course-pack <file>");
  console.error("         course reconcile <repo> --course-pack <file> --projection <file>");
}

function parse(argv) {
  if (!argv.length) return null;
  const operation = argv.shift();
  let artifactAction = null;
  let courseAction = null;
  if (operation === "artifact") {
    artifactAction = argv.shift() || null;
    if (!new Set(["inspect", "release", "compare", "verify"]).has(artifactAction)) throw new Error("artifact requires inspect, release, compare or verify");
  }
  if (operation === "course") {
    courseAction = argv.shift() || null;
    if (!new Set(["compile", "verify", "reconcile"]).has(courseAction)) throw new Error("course requires compile, verify or reconcile");
  }
  let repository = ".";
  if (argv[0] && !argv[0].startsWith("--")) repository = argv.shift();
  const options = {};
  const values = new Set(["--task", "--source", "--target-id", "--semantic-digest", "--provider-revision", "--max-objects", "--phase", "--input", "--select", "--selection", "--packet", "--evidence", "--selector", "--reason", "--confidence", "--context-budget", "--boundary", "--expected-graph-digest", "--receipt-digest", "--state-root", "--matter-id", "--direction", "--artifact-root", "--release-date", "--release-id", "--parent-release", "--base-release", "--target-release", "--client-note", "--technology", "--scenario", "--audience", "--course-pack", "--projection"]);
  const flags = new Set(["--apply", "--refresh-binding", "--significant-work", "--create-export"]);
  values.add("--provider-archive-trust");
  const names = {
    "--provider-archive-trust": "providerArchiveTrustFile",
    "--task": "task", "--source": "source", "--target-id": "targetId",
    "--semantic-digest": "semanticDigest", "--provider-revision": "providerRevision",
    "--max-objects": "maxObjects", "--apply": "apply",
    "--refresh-binding": "refreshBinding", "--significant-work": "significantWork",
    "--phase": "phase", "--input": "input", "--select": "selectedIds",
    "--selection": "selectionFile", "--packet": "packetFile", "--evidence": "evidenceFile",
    "--selector": "selector", "--reason": "reason", "--confidence": "confidence",
    "--context-budget": "contextBudget",
    "--boundary": "boundary", "--expected-graph-digest": "expectedGraphDigest",
    "--receipt-digest": "receiptDigest", "--state-root": "stateRoot",
    "--matter-id": "matterId", "--direction": "direction", "--artifact-root": "artifactRoot",
    "--release-date": "releaseDate", "--release-id": "releaseId",
    "--parent-release": "parentReleaseIds", "--base-release": "baseReleaseId",
    "--target-release": "targetReleaseId", "--client-note": "clientNote",
    "--create-export": "createExport",
    "--technology": "technologyFile", "--scenario": "scenarioIds",
    "--audience": "audience", "--course-pack": "coursePackFile", "--projection": "projectionFile",
  };
  while (argv.length) {
    const token = argv.shift();
    if (flags.has(token)) options[names[token]] = true;
    else if (values.has(token)) {
      if (!argv.length) throw new Error(`missing value for ${token}`);
      const value = argv.shift();
      if (token === "--select") options.selectedIds = [...(options.selectedIds || []), value];
      else if (token === "--parent-release") options.parentReleaseIds = [...(options.parentReleaseIds || []), value];
      else if (token === "--scenario") options.scenarioIds = [...(options.scenarioIds || []), value];
      else options[names[token]] = value;
    } else throw new Error(`unsupported argument ${token}`);
  }
  if (artifactAction) options.artifactAction = artifactAction;
  if (courseAction) options.courseAction = courseAction;
  return { operation, repository: path.resolve(repository), options };
}

function readJsonFile(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`unsafe or missing JSON input ${file}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
}

function hydrateContextOptions(request) {
  if (request.options.providerArchiveTrustFile) {
    if (request.operation !== "connect") throw new Error("archive trust is only supported by connect");
    request.options.providerArchive = readJsonFile(request.options.providerArchiveTrustFile);
  }
  if (request.operation === "sync" && request.options.boundary) {
    if (request.options.boundary !== "task_start" && !request.options.evidenceFile) throw new Error(`${request.options.boundary} requires --evidence`);
    if (request.options.evidenceFile) request.options.continuityEvidence = readJsonFile(request.options.evidenceFile);
    return;
  }
  if (request.operation !== "context" || !request.options.phase) return;
  const phase = request.options.phase;
  if (!new Set(["discover", "expand", "compile", "verify"]).has(phase)) throw new Error(`unsupported context phase ${phase}`);
  if (["expand", "compile"].includes(phase)) {
    if (!request.options.input) throw new Error(`${phase} requires --input`);
    const payload = readJsonFile(request.options.input);
    request.options.traversalReceipt = payload.traversal_receipt || payload;
  }
  if (phase === "compile") {
    if (!request.options.selectionFile) throw new Error("compile requires --selection");
    request.options.selection = readJsonFile(request.options.selectionFile);
  }
  if (phase === "verify") {
    if (!request.options.packetFile || !request.options.evidenceFile) throw new Error("verify requires --packet and --evidence");
    const packet = readJsonFile(request.options.packetFile);
    request.options.contextPack = packet.context_pack || packet;
    request.options.usageEvidence = readJsonFile(request.options.evidenceFile);
  }
}

let request;
try { request = parse(process.argv.slice(2)); }
catch (error) {
  console.error(error.message); usage(); process.exit(1);
}
if (!request) { usage(); process.exit(1); }
try { hydrateContextOptions(request); }
catch (error) { console.error(error.message); usage(); process.exit(1); }

let output;
try { output = execute(request.operation, request.repository, request.options); }
catch (error) {
  output = {
    schema_version: "1.0.0",
    operation_id: `mirai.project_technology.${request.operation}`,
    operation_mode: "read_only",
    status: "fail",
    changed: false,
    blockers: ["project_technology_unhandled_error"],
    warnings: [],
    next_action: "inspect the local error and retry safely",
  };
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = output.status === "fail" ? 1 : ["blocked", "needs_more_discovery", "needs_decision"].includes(output.status) ? 2 : 0;
