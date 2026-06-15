#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const node = process.execPath;
const cli = path.join(root, "packages", "cli", "mirai-graph.js");
const validator = path.join(root, "packages", "cli", "validate-mirai-graph.js");

function run(args, options = {}) {
  return spawnSync(node, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options
  });
}

function runValidator(args, options = {}) {
  return spawnSync(node, [validator, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options
  });
}

function readJson(text) {
  return JSON.parse(text);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current).sort()) {
      const abs = path.join(current, entry);
      const rel = path.relative(dir, abs);
      if (fs.statSync(abs).isDirectory()) {
        walk(abs);
      } else {
        out.push(rel);
      }
    }
  }
  walk(dir);
  return out;
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source)) {
    const src = path.join(source, entry);
    const dst = path.join(target, entry);
    if (fs.statSync(src).isDirectory()) {
      copyDir(src, dst);
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-graph-self-service-"));

const noGraph = path.join(root, "examples", "self-service-onboarding", "no-graph");
const staleGraph = path.join(root, "examples", "self-service-onboarding", "stale-graph");
const existingGraph = path.join(root, "examples", "self-service-onboarding", "existing-graph");

const beforeDetect = listFiles(noGraph);
const detect = run(["detect", noGraph, "--json"]);
assert(detect.status === 0, `detect failed: ${detect.stderr}`);
if (detect.status === 0) {
  const result = readJson(detect.stdout);
  assert(result.graph_presence === "missing", "detect should classify no-graph fixture as missing");
  assert(result.recommended_profile === "software_specification", "detect should recommend software_specification for package.json/src fixture");
  assert(result.canonical_write_allowed === false, "detect must not allow canonical writes");
}
assert(JSON.stringify(beforeDetect) === JSON.stringify(listFiles(noGraph)), "detect must not write files");

const staleDetect = run(["detect", staleGraph, "--json"]);
assert(staleDetect.status === 0, `stale detect failed: ${staleDetect.stderr}`);
if (staleDetect.status === 0) {
  const result = readJson(staleDetect.stdout);
  assert(result.graph_presence === "incomplete", "stale fixture should be incomplete");
  assert(result.missing_artifacts.includes(path.join("graph", "objects.json")), "stale fixture should report missing graph/objects.json");
}

const bootstrapTarget = path.join(tmpRoot, "bootstrap-target");
copyDir(noGraph, bootstrapTarget);
const bootstrap = run(["bootstrap", bootstrapTarget, "--mode", "suggest", "--json"]);
assert(bootstrap.status === 0, `bootstrap suggest failed: ${bootstrap.stderr}`);
if (bootstrap.status === 0) {
  const result = readJson(bootstrap.stdout);
  assert(result.mode === "bootstrap_suggest", "bootstrap should report bootstrap_suggest");
  assert(result.canonical_write_allowed === false, "bootstrap suggest must not allow canonical writes");
  assert(fs.existsSync(result.proposal_ref), "bootstrap proposal should exist");
  const proposal = readJson(fs.readFileSync(result.proposal_ref, "utf8"));
  assert(proposal.canonical_write_allowed === false, "bootstrap proposal must keep canonical_write_allowed=false");
  assert(!fs.existsSync(path.join(bootstrapTarget, "mirai-graph-package.json")), "bootstrap suggest must not create canonical manifest");
}

const initTarget = path.join(tmpRoot, "init-target");
fs.mkdirSync(initTarget, { recursive: true });
const init = run(["init", initTarget, "--profile", "software_specification"]);
assert(init.status === 0, `init failed: ${init.stderr}`);
assert(fs.existsSync(path.join(initTarget, "mirai-graph-package.json")), "init should create manifest");
assert(fs.existsSync(path.join(initTarget, "graph", "objects.json")), "init should create graph/objects.json");
assert(fs.existsSync(path.join(initTarget, "graph", "relations.json")), "init should create graph/relations.json");
assert(fs.existsSync(path.join(initTarget, "gates", "results.json")), "init should create gates/results.json");

const initValidation = runValidator([initTarget]);
assert(initValidation.status === 0, `created package should validate: ${initValidation.stderr || initValidation.stdout}`);

const existingTarget = path.join(tmpRoot, "existing-target");
copyDir(existingGraph, existingTarget);
const initExisting = run(["init", existingTarget, "--profile", "software_specification"]);
assert(initExisting.status !== 0, "init should fail on existing graph files without --force");
assert(initExisting.stderr.includes("Refusing") || initExisting.stderr.includes("already has graph files"), "init existing failure should explain overwrite boundary");

const invalidProfile = run(["init", path.join(tmpRoot, "invalid-profile"), "--profile", "unknown_profile"]);
assert(invalidProfile.status !== 0, "invalid profile should fail");
assert(invalidProfile.stderr.includes("Unknown profile"), "invalid profile should produce actionable error");

const markdown = run(["detect", noGraph, "--markdown"]);
assert(markdown.status === 0, `detect markdown failed: ${markdown.stderr}`);
assert(markdown.stdout.includes("Mirai Graph Self-Service Report"), "detect markdown should include report title");

const fixtureProposal = JSON.parse(fs.readFileSync(path.join(root, "examples", "self-service-onboarding", "bootstrap-proposal", "bootstrap-proposal.json"), "utf8"));
assert(fixtureProposal.canonical_write_allowed === false, "static bootstrap proposal fixture must keep canonical_write_allowed=false");

const result = {
  mode: "self_service_onboarding",
  valid: errors.length === 0,
  temp_dir: tmpRoot,
  checked: [
    "detect read-only",
    "stale graph detection",
    "bootstrap suggest proposal",
    "init creates valid package",
    "init overwrite negative",
    "invalid profile negative",
    "markdown report",
    "static proposal fixture"
  ],
  errors
};

console.log(JSON.stringify(result, null, 2));

if (errors.length > 0) {
  process.exit(1);
}
