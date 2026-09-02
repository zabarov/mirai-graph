#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const readinessRef = "releases/2.1.0-readiness.json";
const readiness = JSON.parse(fs.readFileSync(path.join(root, readinessRef), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const rcVersion = "2.1.0-rc.1";
const stableVersion = "2.1.0";
function coreVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) throw new Error(`invalid_version:${value}`);
  return match.slice(1).map(Number);
}

function compareCore(left, right) {
  const leftParts = coreVersion(left);
  const rightParts = coreVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

const packageIsLaterThanStable = compareCore(packageJson.version, stableVersion) > 0;
const targetVersion = packageJson.version === stableVersion || packageIsLaterThanStable ? stableVersion : rcVersion;
const preparationPhase = targetVersion === stableVersion ? "stable" : "rc";
const errors = [];
const selfTest = process.argv.includes("--self-test");

const prerequisiteIds = [
  "gate.2_0_core_security_freeze",
  "gate.2_1_contract_inventory",
  "gate.2_1_automated_suite",
  "gate.2_1_cross_implementation_conformance",
  "gate.2_1_controlled_pilots",
  "gate.independent_security_review",
  "gate.2_1_migration_compatibility",
  "gate.scientific_claim_boundary"
];
if (preparationPhase === "stable") prerequisiteIds.push("gate.2_1_clean_room_cross_platform");
const gates = new Map((readiness.gates || []).map((gate) => [gate.id, gate]));
const prerequisiteBlockers = [];
for (const id of prerequisiteIds) {
  const gate = gates.get(id);
  if (!gate) errors.push(`required_gate_missing:${id}`);
  else if (gate.status !== "passed") prerequisiteBlockers.push(id);
}

const preparationAllowed = errors.length === 0 && prerequisiteBlockers.length === 0;
const releaseNoteRef = `releases/${targetVersion}.md`;
const releaseNoteExists = fs.existsSync(path.join(root, releaseNoteRef));

function assessMetadata(preparationIsAllowed, packageVersion, noteExists, evaluatedVersion, phase, expectedVersion, allowHistoricalStable = false) {
  const metadataErrors = [];
  if (!preparationIsAllowed && packageVersion === expectedVersion) {
    metadataErrors.push(`${phase}_version_set_before_prerequisite_gates_passed`);
  }
  if (!preparationIsAllowed && noteExists) {
    metadataErrors.push(`${phase}_release_note_created_before_prerequisite_gates_passed`);
  }
  const historicalStableIsCompatible = allowHistoricalStable && evaluatedVersion === stableVersion;
  if (evaluatedVersion !== packageVersion && !historicalStableIsCompatible) {
    metadataErrors.push("readiness_package_version_mismatch");
  }
  return metadataErrors;
}

if (selfTest) {
  const selfTestErrors = assessMetadata(false, rcVersion, true, "2.0.0-alpha.3", "rc", rcVersion);
  const expected = [
    "rc_version_set_before_prerequisite_gates_passed",
    "rc_release_note_created_before_prerequisite_gates_passed",
    "readiness_package_version_mismatch"
  ];
  const valid = expected.every((item) => selfTestErrors.includes(item));
  process.stdout.write(`${JSON.stringify({ valid, self_test: "premature_rc_metadata_fails_closed", errors: selfTestErrors }, null, 2)}\n`);
  process.exitCode = valid ? 0 : 1;
  return;
}
errors.push(...assessMetadata(
  preparationAllowed,
  packageJson.version,
  releaseNoteExists,
  readiness.evaluated_version,
  preparationPhase,
  targetVersion,
  packageIsLaterThanStable
));

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  target_version: targetVersion,
  current_version: packageJson.version,
  preparation_phase: preparationPhase,
  preparation_allowed: preparationAllowed,
  rc_preparation_allowed: preparationAllowed,
  prerequisite_blockers: prerequisiteBlockers,
  proposed_metadata_changes: [
    "package.json",
    "package-lock.json",
    "compat/mirai-graph/package.json",
    releaseNoteRef,
    "README.md",
    "CHANGELOG.md",
    "releases/README.md",
    readinessRef
  ],
  live_actions_allowed: false,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
