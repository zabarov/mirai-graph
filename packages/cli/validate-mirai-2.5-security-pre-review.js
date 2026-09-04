#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const target = path.join(root, "docs/security/mirai-2.5-ai-assisted-pre-review-2026-09-04.json");
const review = JSON.parse(fs.readFileSync(target, "utf8"));
const errors = [];
const requiredScope = ["critical_slot_evidence", "forged_evidence_reference", "authority_and_freshness", "contract_immutability", "parent_child_aggregation", "capability_and_approval_non_authority", "canonical_write_prohibition", "prompt_content_non_authority"];
for (const item of requiredScope) if (!review.scope.includes(item)) errors.push(`required_scope_missing:${item}`);
if (!/^[a-f0-9]{40}$/.test(review.reviewed_revision || "")) errors.push("reviewed_revision_invalid");
if (review.evidence_class !== "internal_ai_assisted_pre_review") errors.push("evidence_class_mismatch");
if (review.release_gate_eligible !== false || review.production_write_authorized !== false || review.canonical_write_allowed !== false) errors.push("pre_review_authority_boundary_broken");
if ((review.findings || []).some((item) => ["critical", "high"].includes(item.severity) && item.status !== "fixed")) errors.push("unresolved_blocking_finding");
if (!/not an external human audit/i.test(review.claim_boundary || "")) errors.push("claim_boundary_missing");
if (/\/Users\/|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+|xoxb-|raw \.env/.test(JSON.stringify(review))) errors.push("public_safety_violation");
const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({valid, reviewed_revision: review.reviewed_revision, verdict: review.verdict, release_gate_eligible: review.release_gate_eligible, errors}, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
