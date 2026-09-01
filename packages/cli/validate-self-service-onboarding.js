#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/mirai.js");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-project-onboarding-"));
const project = path.join(temp, "demo");
fs.mkdirSync(project, { recursive: true });
fs.writeFileSync(path.join(project, "README.md"), "# Demo project\n");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const before = fs.readdirSync(project).sort();
const detect = run(["project", "detect", project, "--json"]);
check(detect.status === 0, `detect failed: ${detect.stderr}`);
if (detect.status === 0) check(JSON.parse(detect.stdout).status === "bootstrap_proposal", "empty project should recommend bootstrap");
check(JSON.stringify(before) === JSON.stringify(fs.readdirSync(project).sort()), "detect must remain read-only");

const suggest = run(["bootstrap", project, "--mode", "suggest", "--profile", "software_specification", "--json"]);
check(suggest.status === 0, `bootstrap suggest failed: ${suggest.stderr}`);
check(!fs.existsSync(path.join(project, "mirai")), "bootstrap suggest must not create canonical capsule");
check(fs.existsSync(path.join(project, ".mirai", "proposals", "bootstrap-proposal.json")), "bootstrap proposal missing");

const init = run(["project", "init", project, "--profile", "software_specification"]);
check(init.status === 0, `init failed: ${init.stderr}`);
check(fs.existsSync(path.join(project, "mirai", "manifest.yaml")), "preferred manifest missing");
check(fs.existsSync(path.join(project, "mirai", "manifest.lock.json")), "lock missing");
check(!fs.existsSync(path.join(project, "graph")), "init must not create legacy graph directory");

const validate = run(["project", "validate", project]);
check(validate.status === 0, `project validation failed: ${validate.stderr}`);
const inspect = run(["project", "inspect", project, "--for-agent", "--task", "review project"]);
check(inspect.status === 0, `agent inspect failed: ${inspect.stderr}`);
if (inspect.status === 0) check(JSON.parse(inspect.stdout).canonical_write_allowed === false, "agent brief cannot authorize writes");

const secondInit = run(["init", project, "--profile", "software_specification"]);
check(secondInit.status !== 0, "compatibility init must refuse existing capsule");

const result = { mode: "self_service_onboarding", valid: errors.length === 0, checked: ["read-only detect", "proposal-only bootstrap", "preferred capsule init", "project validation", "agent handshake", "overwrite refusal"], errors };
console.log(JSON.stringify(result, null, 2));
fs.rmSync(temp, { recursive: true, force: true });
if (errors.length) process.exit(1);
