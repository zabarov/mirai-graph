#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core/index.js");
const { createFilesystemSourceProvider, buildSourceSnapshot, convertPayloads, DEFAULT_SOURCE_BUDGET } = require("../../dist/cjs/sources/index.js");
const { organizeKnowledge } = require("../../dist/cjs/knowledge/index.js");
const { observationsFromUnits, discoverProcessCandidates } = require("../../dist/cjs/technology/index.js");
const { planAutonomicCycle } = require("../../dist/cjs/evolution/index.js");

function write(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const example = path.join(root, "examples/mirai-autonomic-fabric-minimal");
  const descriptor = JSON.parse(fs.readFileSync(path.join(example, "source-descriptor.json"), "utf8"));
  const provider = createFilesystemSourceProvider();
  const payloads = await provider.scan(descriptor, DEFAULT_SOURCE_BUDGET);
  const snapshot = buildSourceSnapshot(descriptor, payloads, undefined, DEFAULT_SOURCE_BUDGET);
  const placement = { contract_version: "1.0.0", id: "placement.autonomic-demo.external-sot", source_scope: "autonomic-demo", placement: "external_sot", retention: "source_owned", contains_bulk_content: false, contains_secrets: false, canonical_write_allowed: false };
  const conversion = await convertPayloads(snapshot, payloads, DEFAULT_SOURCE_BUDGET);
  const knowledgeInput = { units: conversion.units, known_identities: ["autonomic-demo:release_process"] };
  const knowledge = organizeKnowledge(knowledgeInput);
  const intended = observationsFromUnits(conversion.units, { mode: "intended", process_hint: "governed_release" });
  const observed = observationsFromUnits(conversion.units, { mode: "observed", process_hint: "governed_release" }).map((item) => ({ ...item, id: `${item.id}.observed`, sequence: item.sequence.slice(0, 2), confidence: 0.5 }));
  const observations = [...intended, ...observed];
  const candidates = discoverProcessCandidates(observations);
  const adaptiveBase = { contract_version: "1.0.0", scope: "autonomic-demo", revision: 0, records: {}, applied_proposal_ids: [] };
  const baseStateDigest = digestValue(adaptiveBase);
  const envelopeBody = {
    contract_version: "1.0.0",
    id: "autonomy.autonomic-demo.low-risk",
    scope: "autonomic-demo",
    allowed_change_kinds: ["source_freshness", "derived_navigation", "reviewed_alias", "adaptive_statistic", "effect_free_program"],
    forbidden_targets: ["adaptive/protected/**"],
    risk_ceiling: "low",
    confidence_floor: 0.7,
    evidence_requirements: ["evidence:fixture"],
    replay_requirements: { required_for: ["effect_free_program"], minimum_successful_replays: 3 },
    resource_patterns: ["adaptive/**"],
    change_budget: { max_changes: 100, max_payload_bytes: 1048576 },
    issued_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    rollback_contract: { required: true, retention_ms: 2592000000, verify_readback: true },
    policy_digest: digestValue({ policy: "fixture-low-risk-only" }),
    approver_signatures: [{ signer_ref: "owner.fixture", signature_ref: "host-local:fixture", signature_digest: digestValue({ fixture: "approval" }) }],
    canonical_write_allowed: false
  };
  const envelope = { ...envelopeBody, digest: digestValue(envelopeBody) };
  const cycleInput = {
    id: "cycle.autonomic-demo.001",
    scope: "autonomic-demo",
    observed_at: "2026-09-02T12:00:00.000Z",
    source_snapshot_refs: [{ source_id: descriptor.id, snapshot_digest: snapshot.digest }],
    units: conversion.units,
    observations,
    known_identities: ["autonomic-demo:release_process"],
    base_state_digest: baseStateDigest,
    evolution_evidence_refs: ["evidence:fixture"],
    envelope
  };
  const cycle = planAutonomicCycle(cycleInput);
  write(path.join(example, "results/source-snapshot.json"), snapshot);
  write(path.join(example, "results/data-placement-policy.json"), placement);
  write(path.join(example, "results/conversion-result.json"), conversion);
  write(path.join(example, "results/knowledge-proposal.json"), knowledge);
  write(path.join(example, "results/process-observations.json"), { observations });
  write(path.join(example, "results/process-candidates.json"), { candidates });
  write(path.join(example, "results/autonomy-envelope.json"), envelope);
  write(path.join(example, "results/adaptive-base-state.json"), { ...adaptiveBase, digest: baseStateDigest });
  write(path.join(example, "results/autonomic-cycle-input.json"), cycleInput);
  write(path.join(example, "results/autonomic-cycle.json"), cycle);
  write(path.join(example, "results/evolution-proposal.json"), cycle.evolution_proposal);
  write(path.join(example, "results/evolution-decision.json"), cycle.evolution_decision);
  process.stdout.write(`${JSON.stringify({ status: "generated", example: path.relative(root, example), snapshot_digest: snapshot.digest, cycle_digest: cycle.digest, canonical_write_allowed: false }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
