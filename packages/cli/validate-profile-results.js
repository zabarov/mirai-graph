#!/usr/bin/env node

const fs = require("fs");

const resultFiles = [
  "examples/minimal-graph/results/profile-conformance-result.json",
  "examples/ai-employee-minimal/results/profile-conformance-result.json",
  "examples/skill-runtime-minimal/results/profile-conformance-result.json",
  "benchmarks/synthetic-context-reduction-v0/results/profile-conformance-result.json",
  "pilots/independent-implementation-001-conference-planning/results/profile-conformance-result.json",
  "pilots/independent-implementation-002-software-specification/results/profile-conformance-result.json"
];

const errors = [];

for (const file of resultFiles) {
  let result;
  try {
    result = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: cannot read JSON: ${error.message}`);
    continue;
  }

  if (result.valid !== true) {
    errors.push(`${file}: valid must be true`);
  }

  if (!Array.isArray(result.errors) || result.errors.length !== 0) {
    errors.push(`${file}: errors must be an empty array`);
  }

  if (typeof result.profile !== "string" || result.profile.trim() === "") {
    errors.push(`${file}: profile must be a non-empty string`);
  }

  if (typeof result.command !== "string" || !result.command.includes("validate-growgraph.js")) {
    errors.push(`${file}: command must reference validate-growgraph.js`);
  }

  if (
    typeof result.claim_supported !== "string" ||
    !result.claim_supported.includes("declared GrowGraph profile shape")
  ) {
    errors.push(`${file}: claim_supported must stay limited to profile shape conformance`);
  }
}

const output = {
  mode: "profile_conformance_results",
  valid: errors.length === 0,
  checked_files: resultFiles,
  errors
};

console.log(JSON.stringify(output, null, 2));
process.exit(output.valid ? 0 : 1);
