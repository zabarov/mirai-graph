#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "../..");
const workflowRef = ".github/workflows/ci.yml";
const workflow = YAML.parse(fs.readFileSync(path.join(root, workflowRef), "utf8"));
const jobs = workflow.jobs || {};
const errors = [];

function job(id) {
  if (!jobs[id]) errors.push(`missing_job:${id}`);
  return jobs[id] || {};
}

function commands(value) {
  return (value.steps || [])
    .map((step) => typeof step.run === "string" ? step.run.trim() : "")
    .filter(Boolean);
}

function requireCommand(jobId, expected) {
  if (!commands(job(jobId)).includes(expected)) {
    errors.push(`missing_command:${jobId}:${expected}`);
  }
}

function requireCrossPlatform(jobId) {
  const os = job(jobId).strategy?.matrix?.os || [];
  const expected = ["ubuntu-latest", "macos-latest", "windows-latest"];
  for (const value of expected) {
    if (!os.includes(value)) errors.push(`missing_os:${jobId}:${value}`);
  }
}

requireCrossPlatform("mirai-program");
requireCrossPlatform("clean-room-package");
requireCommand("mirai-program", "npm run test:mirai-alpha3");
requireCommand("mirai-program", "npm run test:mirai-2.1");
requireCommand("mirai-program", "npm run test:mirai-property-fuzz");
requireCommand("clean-room-package", "npm run validate:clean-room-install");
requireCommand("release-check", "npm run release:check");

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  workflow: workflowRef,
  required_operating_systems: ["ubuntu-latest", "macos-latest", "windows-latest"],
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
