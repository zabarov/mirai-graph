#!/usr/bin/env node

const fs = require("fs");
const { spawnSync } = require("child_process");

const stateMachine = "examples/process-transition-minimal/state-machine.json";
const fixtures = [
  "examples/process-transition-minimal/results/transition-explanation-valid.json",
  "examples/process-transition-minimal/results/transition-explanation-invalid-ready-to-written.json"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runValidator(args) {
  return spawnSync(process.execPath, ["packages/cli/validate-mirai-graph.js", ...args], {
    encoding: "utf8"
  });
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortJson(value[key])])
    );
  }
  return value;
}

function stable(value) {
  return JSON.stringify(sortJson(value));
}

const errors = [];

for (const fixturePath of fixtures) {
  const fixture = readJson(fixturePath);
  const run = runValidator(["process-transition", stateMachine, fixture.request_ref]);
  let output;
  try {
    output = JSON.parse(run.stdout);
  } catch (error) {
    errors.push(`${fixturePath}: validator did not emit parseable JSON`);
    continue;
  }

  if (output.valid !== fixture.expected_valid) {
    errors.push(`${fixturePath}: expected valid=${fixture.expected_valid}, got ${output.valid}`);
  }

  if (fixture.expected_valid && run.status !== 0) {
    errors.push(`${fixturePath}: expected validator exit 0, got ${run.status}`);
  }

  if (!fixture.expected_valid && run.status === 0) {
    errors.push(`${fixturePath}: expected validator to fail`);
  }

  if (!output.explanation || typeof output.explanation !== "object") {
    errors.push(`${fixturePath}: missing explanation object`);
    continue;
  }

  if (stable(output.explanation) !== stable(fixture.explanation)) {
    errors.push(`${fixturePath}: explanation does not match committed fixture`);
  }

  if (fixture.expected_error && !output.errors.includes(fixture.expected_error)) {
    errors.push(`${fixturePath}: expected error not found`);
  }
}

const markdown = runValidator([
  "--markdown",
  "process-transition",
  stateMachine,
  "examples/process-transition-minimal/transition-request.json"
]);
if (markdown.status !== 0) {
  errors.push(`markdown report failed with exit ${markdown.status}`);
}
for (const requiredText of [
  "Process Transition Decision Report",
  "Transition: `release_ready -> released`",
  "Kaizen decision: `satisfied`",
  "Missing Evidence"
]) {
  if (!markdown.stdout.includes(requiredText)) {
    errors.push(`markdown report missing ${requiredText}`);
  }
}

const output = {
  mode: "process_transition_report",
  valid: errors.length === 0,
  checked_files: fixtures,
  errors
};

console.log(JSON.stringify(output, null, 2));
process.exit(output.valid ? 0 : 1);
