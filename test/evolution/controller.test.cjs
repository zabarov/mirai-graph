const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const os = require("node:os");
const { digestValue } = require("../../dist/cjs/core");
const { planAutonomicCycle, runAutonomicReconcileOnce } = require("../../dist/cjs/evolution");

test("bounded autonomic reconcile is deterministic and proposal-first", () => {
  const fixture = path.resolve(__dirname, "../../examples/mirai-autonomic-fabric-minimal/results/autonomic-cycle-input.json");
  const input = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const first = planAutonomicCycle(input);
  const second = planAutonomicCycle(input);
  assert.equal(first.digest, second.digest);
  assert.equal(first.canonical_write_allowed, false);
  assert.equal(first.processes.intended_count, 1);
  assert.equal(first.processes.observed_count, 1);
  assert.equal(first.processes.candidates.find((item) => item.mode === "observed").technology_draft_allowed, false);
  assert.equal(first.evolution_proposal.changes.every((item) => item.stratum === "adaptive_canonical"), true);
});

test("a blocked knowledge cycle cannot be applied even when it contains a low-risk freshness change", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-blocked-cycle-"));
  try {
    const makeUnit = (id, status) => ({ contract_version: "1.0.0", id, source_ref: `source:${id}`, source_fingerprint: digestValue(id), kind: "record", media_type: "application/json", ordinal: 1, content: { title: "Policy", status }, content_digest: digestValue({ title: "Policy", status }), authority: "owner_asserted", scope: "demo", confidentiality: "internal", instructions_authorized: false });
    const stale = { contract_version: "1.0.0", id: "assertion.stale", identity_key: "demo:old", semantic_type: "record", label: "Old", predicate: "status", value: "active", value_digest: digestValue("active"), scope: "demo", confidentiality: "internal", quality: { extraction_confidence: 1, source_authority: "owner_asserted", corroboration_count: 1, freshness: "current", conflict_state: "none" }, provenance: [{ source_ref: "source:missing", source_fingerprint: digestValue("missing"), content_digest: digestValue("active") }], lifecycle: "candidate", source_state: "available", authority_decision_required: false, canonical_write_allowed: false };
    const envelopeBody = { contract_version: "1.0.0", id: "envelope.blocked", scope: "demo", allowed_change_kinds: ["source_freshness"], forbidden_targets: ["adaptive/protected/**"], risk_ceiling: "low", confidence_floor: 0.8, evidence_requirements: ["evidence:test"], replay_requirements: { required_for: [], minimum_successful_replays: 0 }, resource_patterns: ["adaptive/**"], change_budget: { max_changes: 4, max_payload_bytes: 4096 }, issued_at: "2026-01-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z", rollback_contract: { required: true, retention_ms: 86400000, verify_readback: true }, policy_digest: digestValue({ policy: "test" }), approver_signatures: [{ signer_ref: "owner", signature_ref: "local:test", signature_digest: digestValue("signature") }], canonical_write_allowed: false };
    const envelope = { ...envelopeBody, digest: digestValue(envelopeBody) };
    const emptyState = { contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] };
    const input = { id: "cycle.blocked", scope: "demo", observed_at: "2026-09-02T00:00:00.000Z", source_snapshot_refs: [], units: [makeUnit("one", "draft"), makeUnit("two", "active")], observations: [], previous_assertions: [stale], base_state_digest: digestValue(emptyState), evolution_evidence_refs: ["evidence:test"], envelope };
    const planned = planAutonomicCycle(input);
    assert.equal(planned.status, "manual_review_required");
    assert.equal(planned.evolution_proposal.changes.length > 0, true);
    assert.throws(() => runAutonomicReconcileOnce(input, { apply: true, root, state_ref: ".mirai/adaptive/state.json", authorization_ref: "authorization.test", verify_authorization: () => true }), /autonomic_apply_requires_planned_cycle/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
