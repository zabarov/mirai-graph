#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/mirai.js");
const fixture = (name) => path.join(root, "examples/mirai-outcome-completion-minimal", name);
const home = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-outcome-cli-check-"));
const evidence = JSON.parse(fs.readFileSync(fixture("evidence-set.json"), "utf8"));
const registryBody = { policy_digest: evidence.policy_digest, evidence_sets: { [evidence.digest]: evidence.items.map((item) => item.admission_receipt_digest) } };
fs.writeFileSync(path.join(home, "outcome-admissions.json"), `${JSON.stringify({ ...registryBody, digest: digestValue(registryBody) }, null, 2)}\n`);
function run(args, expected = 0) { const result = spawnSync(process.execPath, [cli, ...args, "--home", home], { cwd: root, encoding: "utf8" }); if (result.status !== expected) throw new Error(`${args.join(" ")}: ${result.stderr || result.stdout}`); return result.stdout; }
const validation = JSON.parse(run(["outcome", "validate", fixture("outcome-contract.json")]));
if (!validation.valid) throw new Error("valid_contract_rejected");
const assessment = JSON.parse(run(["outcome", "assess", "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json")]));
if (assessment.status !== "satisfied" || assessment.execution_allowed || assessment.canonical_write_allowed) throw new Error("assessment_boundary_failed");
const markdown = run(["outcome", "explain", fixture("assessment.json"), "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json"), "--markdown"]);
if (!markdown.includes("No execution, approval, capability or canonical write")) throw new Error("explanation_boundary_missing");
process.stdout.write("Mirai 2.5 outcome CLI: PASS\n");
