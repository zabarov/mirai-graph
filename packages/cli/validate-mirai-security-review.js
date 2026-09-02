#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const target = process.argv[2] || "docs/security/mirai-independent-security-review-result.template.json";
const selfTest = target === "--self-test";
const sourceTarget = selfTest ? "docs/security/mirai-independent-security-review-result.template.json" : target;
const value = JSON.parse(fs.readFileSync(path.resolve(root, sourceTarget), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/mirai-security-review-result.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const requiredScope = [
  "program_parsing", "path_and_symlink_boundary", "command_execution",
  "capability_scope", "approval_integrity", "crash_and_idempotency",
  "compensation", "evidence_redaction", "manifest_authority",
  "activation_budgets", "activation_policy_binding",
  "activation_host_budget_ceilings", "process_run_production_exclusion",
  "renewable_lease_and_generation_fencing",
  "cross_process_mutation_serialization"
];
function assess(candidate) {
  const errors = [];
  if (!validate(candidate)) errors.push(...(validate.errors || []).map((error) => `schema:${error.instancePath || "/"}:${error.message}`));
  for (const item of requiredScope) if (!(candidate.scope || []).includes(item)) errors.push(`required_scope_missing:${item}`);
  const ids = new Set();
  for (const finding of candidate.findings || []) {
    if (ids.has(finding.id)) errors.push(`duplicate_finding:${finding.id}`);
    ids.add(finding.id);
  }
  const unresolvedBlocking = (candidate.findings || []).filter((finding) => ["critical", "high"].includes(finding.severity) && ["open", "accepted_risk"].includes(finding.status));
  const passing = ["pass_for_production_read", "pass_for_bounded_production_write"].includes(candidate.verdict);
  if (passing && unresolvedBlocking.length) errors.push("passing_verdict_with_unresolved_critical_or_high_finding");
  if (candidate.verdict === "pass_for_bounded_production_write" && !(candidate.adapter_scope || []).length) errors.push("bounded_write_verdict_requires_adapter_scope");
  if (/guarantees|unrestricted production|scientifically proven/i.test(candidate.claim_boundary || "")) errors.push("claim_boundary_overclaim");
  if (/\/Users\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(JSON.stringify(candidate))) errors.push("public_safety_violation");
  const releaseGateEligible = candidate.status === "complete" && candidate.evidence_class === "external_review" && candidate.reviewer?.independent === true && candidate.reviewer?.implemented_reviewed_changes === false && passing && !unresolvedBlocking.length;
  return { errors, releaseGateEligible };
}

if (selfTest) {
  const invalid = structuredClone(value);
  invalid.status = "complete";
  invalid.evidence_class = "external_review";
  invalid.reviewer.independent = true;
  invalid.verdict = "pass_for_production_read";
  invalid.findings = [{ id: "SEC-001", severity: "high", status: "accepted_risk", summary: "Blocking risk", reproduction: "Synthetic self-test", evidence_refs: [] }];
  const result = assess(invalid);
  const passed = result.errors.includes("passing_verdict_with_unresolved_critical_or_high_finding") && result.releaseGateEligible === false;
  process.stdout.write(`${JSON.stringify({ valid: passed, self_test: "high_accepted_risk_blocks_release_gate", errors: result.errors }, null, 2)}\n`);
  process.exitCode = passed ? 0 : 1;
  return;
}

const { errors, releaseGateEligible } = assess(value);

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, target: sourceTarget, status: value.status, verdict: value.verdict, release_gate_eligible: valid && releaseGateEligible, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
