#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const review = JSON.parse(fs.readFileSync(path.join(root, "docs/security/mirai-2.5-isolated-ai-security-review-2026-09-04.json"), "utf8"));
const errors = [];
if (review.evidence_class !== "isolated_ai_assisted_security_review") errors.push("evidence_class_mismatch");
if (!/^[a-f0-9]{40}$/.test(review.reviewed_revision || "")) errors.push("reviewed_revision_invalid");
if (!/^[a-f0-9]{40}$/.test(review.remediation_revision || "")) errors.push("remediation_revision_invalid");
if ((review.findings || []).some((finding) => ["critical", "high"].includes(finding.severity) && finding.status !== "fixed")) errors.push("unresolved_blocking_finding");
if (review.release_gate_eligible !== true) errors.push("rc_security_gate_not_closed");
if (review.production_write_authorized !== false || review.canonical_write_allowed !== false) errors.push("review_authority_boundary_broken");
if (!/not an external human audit/i.test(review.claim_boundary || "")) errors.push("claim_boundary_missing");
if (/\/Users\/|\/private\/tmp\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(JSON.stringify(review))) errors.push("public_safety_violation");
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, reviewed_revision: review.reviewed_revision, remediation_revision: review.remediation_revision, verdict: review.verdict, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
