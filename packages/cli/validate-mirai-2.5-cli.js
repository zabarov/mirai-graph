#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/mirai.js");
const fixture = (name) => path.join(root, "examples/mirai-outcome-completion-minimal", name);
function run(args, expected = 0) { const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" }); if (result.status !== expected) throw new Error(`${args.join(" ")}: ${result.stderr || result.stdout}`); return result.stdout; }
const validation = JSON.parse(run(["outcome", "validate", fixture("outcome-contract.json")]));
if (!validation.valid) throw new Error("valid_contract_rejected");
const assessment = JSON.parse(run(["outcome", "assess", "--contract", fixture("outcome-contract.json"), "--candidates", fixture("candidate-set.json"), "--evidence", fixture("evidence-set.json")]));
if (assessment.status !== "satisfied" || assessment.execution_allowed || assessment.canonical_write_allowed) throw new Error("assessment_boundary_failed");
const markdown = run(["outcome", "explain", fixture("assessment.json"), "--markdown"]);
if (!markdown.includes("No execution, approval, capability or canonical write")) throw new Error("explanation_boundary_missing");
process.stdout.write("Mirai 2.5 outcome CLI: PASS\n");
