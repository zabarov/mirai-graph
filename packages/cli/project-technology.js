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
  console.error("Context: --phase discover --task <text>");
  console.error("         --phase expand --input <receipt.json> --select <id> [--select <id>]");
  console.error("         --phase compile --input <receipt.json> --selection <selection.json>");
  console.error("         --phase verify --packet <context-pack.json> --evidence <usage-evidence.json>");
}

function parse(argv) {
  if (!argv.length) return null;
  const operation = argv.shift();
  let repository = ".";
  if (argv[0] && !argv[0].startsWith("--")) repository = argv.shift();
  const options = {};
  const values = new Set(["--task", "--source", "--target-id", "--semantic-digest", "--provider-revision", "--max-objects", "--phase", "--input", "--select", "--selection", "--packet", "--evidence", "--selector", "--reason", "--confidence", "--context-budget"]);
  const flags = new Set(["--apply", "--refresh-binding", "--significant-work"]);
  const names = {
    "--task": "task", "--source": "source", "--target-id": "targetId",
    "--semantic-digest": "semanticDigest", "--provider-revision": "providerRevision",
    "--max-objects": "maxObjects", "--apply": "apply",
    "--refresh-binding": "refreshBinding", "--significant-work": "significantWork",
    "--phase": "phase", "--input": "input", "--select": "selectedIds",
    "--selection": "selectionFile", "--packet": "packetFile", "--evidence": "evidenceFile",
    "--selector": "selector", "--reason": "reason", "--confidence": "confidence",
    "--context-budget": "contextBudget",
  };
  while (argv.length) {
    const token = argv.shift();
    if (flags.has(token)) options[names[token]] = true;
    else if (values.has(token)) {
      if (!argv.length) throw new Error(`missing value for ${token}`);
      const value = argv.shift();
      if (token === "--select") options.selectedIds = [...(options.selectedIds || []), value];
      else options[names[token]] = value;
    } else throw new Error(`unsupported argument ${token}`);
  }
  return { operation, repository: path.resolve(repository), options };
}

function readJsonFile(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`unsafe or missing JSON input ${file}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
}

function hydrateContextOptions(request) {
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
