#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { compileProgramSource, validateProgram, programDigest } = require("../../dist/cjs/program");
const { standardOperationCatalog } = require("../../dist/cjs/stdlib");
const { snapshot } = require("../../test/fixtures/graph-organization.cjs");

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i], value = process.argv[i + 1];
  if (!["--checker", "--python"].includes(name) || !value || options[name]) throw new Error("invalid_conformance_arguments");
  options[name] = value;
}
if (Object.keys(options).length !== 2) throw new Error("usage: --checker <repo> --python <executable>");
const root = path.resolve(__dirname, "../..");
const catalog = standardOperationCatalog();
const task = JSON.parse(fs.readFileSync(path.join(root, "examples/mirai-task-runtime-minimal/main.mirai.json"), "utf8"));
const pure = compileProgramSource(JSON.stringify({ contract_version: "1.1.0", id: "independent.binding", version: "1.0.0",
  operation_catalog: { id: "mirai.stdlib", contract_version: "1.0.0", digest: catalog.digest },
  entry: "check", nodes: [
    { id: "check", kind: "call", target: { kind: "adapter", adapter: "mirai_stdlib", operation: "graph.validate" },
      effects: ["pure"], args: { graph: { op: "literal", value: snapshot() } }, next: "done" },
    { id: "done", kind: "return", values: {} }],
  policies: { allowed_effects: ["pure"], canonical_write_allowed: false,
    budgets: { max_steps: 4, max_depth: 1, max_iterations: 1, max_parallel: 1, max_duration_ms: 1000 } }
}), "binding.json").program;
const cases = [
  ["native_pure", pure, true, () => {}],
  ["legacy_explicit_adapter", pure, true, p => { p.contract_version = "1.0.0"; delete p.operation_catalog; }],
  ["stale_catalog", pure, false, p => { p.operation_catalog.digest = "sha256:" + "0".repeat(64); }],
  ["unknown_operation", pure, false, p => { p.nodes[0].target.operation = "graph.grant"; }],
  ["missing_argument", pure, false, p => { p.nodes[0].args = {}; }],
  ["literal_type", pure, false, p => { p.nodes[0].args.graph.value = "invalid"; }],
  ["unknown_argument", pure, false, p => { p.nodes[0].args.extra = { op: "literal", value: true }; }],
  ["pure_capability", pure, false, p => { p.nodes[0].capability = "cap.forged"; }],
  ["pure_effect_disguise", pure, false, p => { p.nodes[0].effects = ["task_read"]; p.policies.allowed_effects.push("task_read"); }],
  ["task_calls", task, true, () => {}],
  ["legacy_task_calls", task, false, p => { p.contract_version = "1.0.0"; delete p.operation_catalog; }],
  ["task_missing_capability", task, false, p => { delete p.nodes[0].capability; }],
  ["task_wrong_effect", task, false, p => { p.nodes[0].effects = ["pure"]; }],
  ["task_wrong_adapter", task, false, p => { p.nodes[0].target.adapter = "other"; }],
  ["task_unknown_operation", task, false, p => { p.nodes[0].target.operation = "grant"; }],
  ["task_missing_binding", task, false, p => { delete p.nodes[0].args.plan_digest; }],
  ["task_forged_binding", task, false, p => { p.nodes[0].args.plan_digest.value = "not-a-digest"; }],
  ["task_extra_argument", task, false, p => { p.nodes[0].args.approved = { op: "literal", value: true }; }]
];
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "mirai-program-conformance-"));
try {
  const catalogFile = path.join(temp, "catalog.json");
  fs.writeFileSync(catalogFile, JSON.stringify(catalog));
  const results = cases.map(([id, base, expected, mutate]) => {
    const program = structuredClone(base); mutate(program); program.digest = programDigest(program);
    const file = path.join(temp, `${id}.json`); fs.writeFileSync(file, JSON.stringify(program));
    const result = spawnSync(options["--python"], ["-m", "mirai_conformance.program_organization", file,
      "--catalog", catalogFile, "--schema", path.join(root, "schemas/mirai-program.schema.json")], {
      cwd: path.resolve(options["--checker"]), encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONPATH: path.resolve(options["--checker"]), PYTHONDONTWRITEBYTECODE: "1" }
    });
    if (result.error || ![0, 1].includes(result.status)) throw new Error(`checker_unavailable:${id}:${result.stderr}`);
    let independent;
    try { independent = JSON.parse(result.stdout); } catch { throw new Error(`checker_bad_output:${id}:${result.stderr}`); }
    if (independent.valid !== (result.status === 0)) throw new Error(`checker_exit_mismatch:${id}`);
    const ts = validateProgram(program).valid;
    return { id, expected, typescript: ts, python: independent.valid, passed: ts === expected && independent.valid === expected,
      ...(ts !== independent.valid ? { errors: independent.errors } : {}) };
  });
  const valid = results.every(item => item.passed);
  console.log(JSON.stringify({ valid, corpus: "program_1_1_bindings", results,
    limitations: ["Static binding corpus only; no dynamic expression execution or provider authority proof.",
      "Uses a trusted catalog as contract data, not TypeScript implementation code."], canonical_write_allowed: false }, null, 2));
  if (!valid) process.exitCode = 1;
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
