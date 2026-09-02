#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { digestValue } = require("../../dist/cjs/core");
const { organizeKnowledge } = require("../../dist/cjs/knowledge");
const { observationsFromUnits } = require("../../dist/cjs/technology");
const { planAutonomicCycle } = require("../../dist/cjs/evolution");

const root = path.resolve(__dirname, "../..");
const cases = [
  { id: "self-hosting", title: "Mirai self-hosting release control", records: [{ title: "Schema release", owner_ref: "maintainers", depends_on: ["contract validation", "security review"] }] },
  { id: "federation", title: "Federated capability routing", records: [{ title: "Capability route", owner_ref: "routing owner", requires: ["evidence gate", "quality gate"] }] },
  { id: "modular-software", title: "Modular software delivery", records: [{ title: "Package feature", owner_ref: "package owner", depends_on: ["specification", "tests", "review"] }] },
  { id: "ai-employee", title: "AI employee governed work", records: [{ title: "Customer request", owner_ref: "service owner", requires: ["policy", "approval", "feedback"] }] }
];

function unit(pilot, index, content, kind = "record", authority = "owner_asserted") {
  const source = `synthetic:${pilot}:${index}`;
  return { contract_version: "1.0.0", id: `unit.${pilot}.${index}`, source_ref: source, source_fingerprint: digestValue(source), kind, media_type: kind === "record" ? "application/json" : "text/markdown", ordinal: 1, content, content_digest: digestValue(content), authority, scope: `pilot.${pilot}`, confidentiality: "public", instructions_authorized: false };
}

function envelope(scope) {
  const body = { contract_version: "1.0.0", id: `envelope.${scope}`, scope, allowed_change_kinds: ["derived_navigation", "source_freshness"], forbidden_targets: ["adaptive/protected/**"], risk_ceiling: "low", confidence_floor: 0.7, evidence_requirements: ["evidence:synthetic-pilot"], replay_requirements: { required_for: [], minimum_successful_replays: 0 }, resource_patterns: ["adaptive/**"], change_budget: { max_changes: 50, max_payload_bytes: 1048576 }, issued_at: "2026-01-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z", rollback_contract: { required: true, retention_ms: 2592000000, verify_readback: true }, policy_digest: digestValue({ policy: "synthetic-pilot" }), approver_signatures: [{ signer_ref: "pilot.owner", signature_ref: "synthetic:owner-reviewed", signature_digest: digestValue({ scope }) }], canonical_write_allowed: false };
  return { ...body, digest: digestValue(body) };
}

for (const pilot of cases) {
  const processText = "1. Inspect the bounded request.\n2. Validate required evidence.\n3. If a protected action is needed, request approval.\n4. Record the outcome and Kaizen proposal.";
  const units = [
    ...pilot.records.map((record, index) => unit(pilot.id, index + 1, record)),
    unit(pilot.id, 100, processText, "text", "owner_asserted"),
    unit(pilot.id, 101, "1. Inspect the request.\n2. Skip directly to completion.", "text", "supporting")
  ];
  const intended = observationsFromUnits([units.at(-2)], { mode: "intended", process_hint: `${pilot.id}_work` });
  const observed = observationsFromUnits([units.at(-1)], { mode: "observed", process_hint: `${pilot.id}_work` });
  const adaptiveBase = { contract_version: "1.0.0", scope: `pilot.${pilot.id}`, revision: 0, records: {}, applied_proposal_ids: [] };
  const cycleInput = { id: `cycle.pilot.${pilot.id}`, scope: `pilot.${pilot.id}`, observed_at: "2026-09-02T12:00:00.000Z", source_snapshot_refs: [{ source_id: `synthetic.${pilot.id}`, snapshot_digest: digestValue(units.map((item) => item.content_digest)) }], units, observations: [...intended, ...observed], base_state_digest: digestValue(adaptiveBase), evolution_evidence_refs: ["evidence:synthetic-pilot"], envelope: envelope(`pilot.${pilot.id}`) };
  const knowledge = organizeKnowledge({ units });
  const cycle = planAutonomicCycle(cycleInput);
  const reportBody = {
    contract_version: "1.0.0",
    id: `pilot.mirai-2.2.${pilot.id}`,
    title: pilot.title,
    status: "instrumentation_ready",
    conditions: { manual: "not_run", mirai_2_1_proposal_only: "represented_by_proposal_boundary", mirai_2_2_managed: "represented_by_envelope_decision" },
    metrics: { assertion_count: knowledge.assertions.length, relation_count: knowledge.relation_facts.length, conflict_count: knowledge.conflicts.length, intended_process_count: cycle.processes.intended_count, observed_process_count: cycle.processes.observed_count, managed_change_count: cycle.evolution_proposal.changes.length, managed_decision: cycle.evolution_decision?.verdict || "not_evaluated" },
    evidence: { cycle_digest: cycle.digest, knowledge_digest: knowledge.digest },
    internal_review: "passed_fixture_consistency",
    independent_human_review: "pending",
    production_effects: false,
    limitations: ["Synthetic pilot; it does not establish external validity.", "Model comparison, blind human review and production-read observation remain pending."],
    canonical_write_allowed: false
  };
  const report = { ...reportBody, digest: digestValue(reportBody) };
  const directory = path.join(root, `pilots/mirai-2.2-${pilot.id}-autonomic`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "README.md"), `# ${pilot.title}\n\nStatus: instrumentation-ready synthetic pilot.\n\nThis fixture exercises knowledge organization, intended/observed process separation and autonomy-envelope evaluation. It performs no production effects. Independent human review is pending.\n`);
  fs.writeFileSync(path.join(directory, "pilot-input.json"), `${JSON.stringify(cycleInput, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, "pilot-result.json"), `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify({ status: "generated", pilot_count: cases.length, all_production_effects_disabled: true, canonical_write_allowed: false }, null, 2)}\n`);
