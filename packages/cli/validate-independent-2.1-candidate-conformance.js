#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");

const root = path.resolve(__dirname, "../..");
const candidate = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker-2.1-candidate.json"), "utf8"));
const publication = JSON.parse(fs.readFileSync(path.join(root, candidate.publication_evidence_ref), "utf8"));
const mappings = [
  ["technology-qualification", "examples/mirai-technology-qualification-minimal/qualification-result.json", "conformance/results/python-mirai-2.1-technology-qualification-result.json"],
  ["hybrid-technology-plan", "examples/mirai-technology-qualification-minimal/hybrid-technology-plan.json", "conformance/results/python-mirai-2.1-hybrid-technology-plan-result.json"],
  ["shadow-differential-result", "examples/mirai-shadow-differential-minimal/shadow-result.json", "conformance/results/python-mirai-2.1-shadow-differential-result.json"],
  ["activation-plan", "pilots/mirai-2.1-beta-federation/results/activation-plan.json", "conformance/results/python-mirai-2.1-activation-plan-result.json"],
  ["activation-run-result", "pilots/mirai-2.1-beta-federation/results/activation-run-result.json", "conformance/results/python-mirai-2.1-activation-run-result.json"]
];
const errors = [];
if (!/^[a-f0-9]{40}$/.test(candidate.revision || "")) errors.push("checker_revision_invalid");
if (candidate.imports_typescript_runtime !== false) errors.push("checker_must_not_import_typescript_runtime");
if (candidate.publication_status !== "published_branch" || candidate.release_gate_eligible !== true) errors.push("candidate_public_ci_gate_not_promoted");
if (publication.checker_revision !== candidate.revision) errors.push("publication_checker_revision_mismatch");
if (publication.publication_status !== candidate.publication_status) errors.push("publication_status_mismatch");
if (publication.remote_tracking_verified !== true) errors.push("publication_remote_not_verified");
if (publication.clean_room?.status !== "passed" || publication.clean_room?.python_suite_failed !== 0 || publication.clean_room?.python_suite_passed !== 20) errors.push("publication_clean_room_not_passed");
if (publication.clean_room?.mirai_repo_binding !== "explicit_MIRAI_REPO") errors.push("publication_candidate_binding_not_explicit");
if (publication.public_ci?.status !== "passed" || publication.public_ci?.operating_system_jobs_passed !== 3 || publication.public_ci?.operating_system_jobs_required !== 3 || publication.public_ci?.package_jobs_passed !== 1) errors.push("publication_public_ci_not_passed");
if (!Array.isArray(publication.public_ci?.operating_systems) || !["ubuntu-latest", "macos-latest", "windows-latest"].every((name) => publication.public_ci.operating_systems.includes(name))) errors.push("publication_public_ci_matrix_incomplete");
if (publication.canonical_write_performed !== false || publication.effects_executed !== false) errors.push("publication_safety_boundary_broken");
for (const [kind, artifactRef, resultRef] of mappings) {
  const artifact = JSON.parse(fs.readFileSync(path.join(root, artifactRef), "utf8"));
  const result = JSON.parse(fs.readFileSync(path.join(root, resultRef), "utf8"));
  if (result.kind !== kind || result.status !== "passed" || result.errors.length) errors.push(`${kind}:independent_result_failed`);
  if (result.artifact_digest !== digestValue(artifact)) errors.push(`${kind}:artifact_digest_mismatch`);
  if (result.canonical_write_performed !== false || result.effects_executed !== false) errors.push(`${kind}:safety_boundary_broken`);
}
for (const surface of ["technology_qualifications", "hybrid_technology_plans", "shadow_differentials", "activation_plans", "activation_run_results"]) {
  if (!candidate.supported_surfaces.includes(surface)) errors.push(`supported_surface_missing:${surface}`);
}
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, revision: candidate.revision, publication_status: candidate.publication_status, result_count: mappings.length, release_gate_eligible: valid && candidate.release_gate_eligible === true, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
