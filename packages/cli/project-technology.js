#!/usr/bin/env node

"use strict";

const path = require("path");
const { execute } = require("../project-technology");

function usage() {
  console.error("Usage: mirai-graph technology <operation> [repository] [options]");
  console.error("Read-only: explain | status | plan | verify | context");
  console.error("Transactional: enable | sync | connect | disconnect | provide | disable | repair");
  console.error("Options: --apply --task <text> --source <file> --target-id <id>");
  console.error("         --semantic-digest <sha256:...> --provider-revision <sha>");
  console.error("         --refresh-binding --significant-work --max-objects <count>");
}

function parse(argv) {
  if (!argv.length) return null;
  const operation = argv.shift();
  let repository = ".";
  if (argv[0] && !argv[0].startsWith("--")) repository = argv.shift();
  const options = {};
  const values = new Set(["--task", "--source", "--target-id", "--semantic-digest", "--provider-revision", "--max-objects"]);
  const flags = new Set(["--apply", "--refresh-binding", "--significant-work"]);
  const names = {
    "--task": "task", "--source": "source", "--target-id": "targetId",
    "--semantic-digest": "semanticDigest", "--provider-revision": "providerRevision",
    "--max-objects": "maxObjects", "--apply": "apply",
    "--refresh-binding": "refreshBinding", "--significant-work": "significantWork",
  };
  while (argv.length) {
    const token = argv.shift();
    if (flags.has(token)) options[names[token]] = true;
    else if (values.has(token)) {
      if (!argv.length) throw new Error(`missing value for ${token}`);
      options[names[token]] = argv.shift();
    } else throw new Error(`unsupported argument ${token}`);
  }
  return { operation, repository: path.resolve(repository), options };
}

let request;
try { request = parse(process.argv.slice(2)); }
catch (error) {
  console.error(error.message); usage(); process.exit(1);
}
if (!request) { usage(); process.exit(1); }

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
process.exit(output.status === "fail" ? 1 : output.status === "blocked" ? 2 : 0);
