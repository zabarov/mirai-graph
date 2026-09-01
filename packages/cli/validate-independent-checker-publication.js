#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const document = JSON.parse(fs.readFileSync(path.join(root, "conformance/independent-checker.json"), "utf8"));
const publication = document.checker?.publication || {};
const errors = [];

if (!/^[a-f0-9]{40}$/.test(document.checker?.revision || "")) errors.push("checker_revision_invalid");
if (document.checker?.imports_typescript_runtime !== false) errors.push("checker_must_not_import_typescript_runtime");
if (!/^https:\/\/github\.com\/[^/]+\/mirai-conformance$/.test(publication.intended_remote || "")) errors.push("intended_remote_invalid");
for (const step of ["configure_origin", "push_exact_revision", "run_checker_ci", "verify_public_clone"]) {
  if (!(publication.required_before_public_gate || []).includes(step)) errors.push(`publication_step_missing:${step}`);
}
if (publication.status === "published" && publication.remote_verified !== true) errors.push("published_checker_must_be_remote_verified");
if (publication.status === "local_only" && publication.remote_verified !== false) errors.push("local_checker_cannot_be_remote_verified");
if (publication.status === "published") {
  if (publication.default_branch !== "main") errors.push("published_checker_default_branch_invalid");
  if (publication.public_revision_url !== `${document.checker.repository}/commit/${document.checker.revision}`) errors.push("published_checker_revision_url_mismatch");
  if (!/^https:\/\/github\.com\/[^/]+\/mirai-conformance\/actions\/runs\/[0-9]+$/.test(publication.ci_run_url || "")) errors.push("published_checker_ci_run_url_invalid");
  if (publication.ci_conclusion !== "success") errors.push("published_checker_ci_not_successful");
  for (const target of ["ubuntu-latest", "macos-latest", "windows-latest", "package"]) {
    if (!(publication.ci_matrix || []).includes(target)) errors.push(`published_checker_ci_target_missing:${target}`);
  }
  if (publication.clean_room?.status !== "passed" || publication.clean_room?.tests_passed < 16 || publication.clean_room?.corpus_passed !== 13 || publication.clean_room?.corpus_failed !== 0) {
    errors.push("published_checker_clean_room_evidence_incomplete");
  }
}

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({
  valid,
  checker_revision: document.checker?.revision,
  publication_status: publication.status,
  remote_verified: publication.remote_verified,
  public_gate_closed: publication.status === "published" && publication.remote_verified === true,
  errors
}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
