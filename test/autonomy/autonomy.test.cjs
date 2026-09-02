const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { digestValue } = require("../../dist/cjs/core");
const {
  applyAdaptiveEvolution,
  createAutonomyAuthorizationReceipt,
  evaluateEvolutionProposal,
  rollbackAdaptiveEvolution,
  verifyAutonomyAuthorizationReceipt
} = require("../../dist/cjs/autonomy");

function envelope() {
  const body = { contract_version: "1.0.0", id: "envelope.test", scope: "demo", allowed_change_kinds: ["derived_navigation"], forbidden_targets: ["adaptive/protected/**"], risk_ceiling: "low", confidence_floor: 0.8, evidence_requirements: ["evidence:test"], replay_requirements: { required_for: [], minimum_successful_replays: 0 }, resource_patterns: ["adaptive/**"], change_budget: { max_changes: 4, max_payload_bytes: 4096 }, issued_at: "2026-01-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z", rollback_contract: { required: true, retention_ms: 86400000, verify_readback: true }, policy_digest: digestValue({ policy: "test" }), approver_signatures: [{ signer_ref: "owner", signature_ref: "local:test", signature_digest: digestValue("signature") }], canonical_write_allowed: false };
  return { ...body, digest: digestValue(body) };
}

function proposal(baseStateDigest, kind = "derived_navigation", target = "adaptive/navigation/demo") {
  const payload = { relation_ref: "relation.demo" };
  const change = { id: "change.demo", kind, target_ref: target, stratum: kind === "derived_navigation" ? "adaptive_canonical" : "system_protected", operation: "upsert", payload, payload_digest: digestValue(payload), risk: kind === "derived_navigation" ? "low" : "critical", confidence: 1, reversible: kind === "derived_navigation", effectful: kind !== "derived_navigation", evidence_refs: ["evidence:test"], successful_replay_refs: [], conflict_refs: [] };
  const body = { contract_version: "1.0.0", id: `proposal.${kind}`, scope: "demo", base_state_digest: baseStateDigest, changes: [change], created_from_cycle_ref: "cycle.test", canonical_write_allowed: false };
  return { ...body, digest: digestValue(body) };
}

function redigest(value) {
  const { digest: _digest, ...body } = value;
  return { ...body, digest: digestValue(body) };
}

test("only envelope-bounded adaptive changes can be applied and rolled back", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-autonomy-"));
  const home = path.join(root, "home");
  try {
    const initial = { contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] };
    const approvedEnvelope = envelope();
    const candidate = proposal(digestValue(initial));
    const decision = evaluateEvolutionProposal(candidate, approvedEnvelope, "2026-09-02T00:00:00.000Z");
    assert.equal(decision.verdict, "automatic_promotion_allowed");
    const authorization = createAutonomyAuthorizationReceipt({ home, envelope: approvedEnvelope, approved_by: "owner", now: new Date("2026-09-02T00:00:00.000Z") });
    assert.equal(verifyAutonomyAuthorizationReceipt(authorization, { home, envelope: approvedEnvelope, now: new Date("2026-09-02T00:01:00.000Z") }).valid, true);
    const options = { root, state_ref: ".mirai/adaptive/state.json", proposal: candidate, decision, envelope: approvedEnvelope, authorization_ref: authorization.id, verify_authorization: () => true, applied_at: "2026-09-02T00:01:00.000Z" };
    const receipt = applyAdaptiveEvolution(options);
    assert.equal(receipt.status, "applied");
    assert.equal(fs.readdirSync(path.join(root, ".mirai/evidence/autonomic")).some((name) => name.includes(receipt.digest.slice(7, 19))), true);
    assert.equal(applyAdaptiveEvolution(options).status, "already_applied");
    const unsafeRollback = redigest({ ...receipt, rollback_ref: ".mirai/migration-backups/autonomic/../../../package.json" });
    assert.throws(() => rollbackAdaptiveEvolution({ root, state_ref: ".mirai/adaptive/state.json", receipt: unsafeRollback, rolled_back_at: "2026-09-02T00:02:00.000Z" }), /adaptive_rollback_ref_invalid/);
    assert.equal(rollbackAdaptiveEvolution({ root, state_ref: ".mirai/adaptive/state.json", receipt, rolled_back_at: "2026-09-02T00:02:00.000Z" }).status, "rolled_back");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("protected, effectful and authority-changing proposals are denied", () => {
  const initial = digestValue({ contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] });
  const decision = evaluateEvolutionProposal(proposal(initial, "protected_invariant", "system/protected/safety"), envelope(), "2026-09-02T00:00:00.000Z");
  assert.equal(decision.verdict, "denied");
  assert.equal(decision.change_decisions[0].reason_codes.includes("change_kind_never_automatic"), true);
});

test("change-count and payload budgets deny automatic promotion", () => {
  const initial = digestValue({ contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] });
  const first = proposal(initial);
  const secondPayload = { relation_ref: "relation.second" };
  const secondChange = { ...first.changes[0], id: "change.second", target_ref: "adaptive/navigation/second", payload: secondPayload, payload_digest: digestValue(secondPayload) };
  const overCount = redigest({ ...first, changes: [...first.changes, secondChange] });
  const countEnvelope = redigest({ ...envelope(), change_budget: { max_changes: 1, max_payload_bytes: 4096 } });
  const countDecision = evaluateEvolutionProposal(overCount, countEnvelope, "2026-09-02T00:00:00.000Z");
  assert.equal(countDecision.verdict, "denied");
  assert.equal(countDecision.change_decisions.every((item) => item.verdict === "deny" && item.reason_codes.includes("change_count_budget_exceeded")), true);

  const byteEnvelope = redigest({ ...envelope(), change_budget: { max_changes: 4, max_payload_bytes: 1 } });
  const byteDecision = evaluateEvolutionProposal(first, byteEnvelope, "2026-09-02T00:00:00.000Z");
  assert.equal(byteDecision.verdict, "denied");
  assert.equal(byteDecision.change_decisions[0].reason_codes.includes("change_payload_budget_exceeded"), true);
});

test("apply recomputes proposal, envelope and decision integrity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-autonomy-integrity-"));
  try {
    const initial = { contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] };
    const approvedEnvelope = envelope();
    const candidate = proposal(digestValue(initial));
    const decision = evaluateEvolutionProposal(candidate, approvedEnvelope, "2026-09-02T00:00:00.000Z");
    const base = { root, state_ref: ".mirai/adaptive/state.json", proposal: candidate, decision, envelope: approvedEnvelope, authorization_ref: "authorization.test", verify_authorization: () => true, applied_at: "2026-09-02T00:01:00.000Z" };

    const forgedProposal = redigest({ ...candidate, changes: [{ ...candidate.changes[0], kind: "capability", effectful: false }] });
    const forgedDecisionBody = { ...decision, proposal_digest: forgedProposal.digest, verdict: "automatic_promotion_allowed", change_decisions: [{ change_id: forgedProposal.changes[0].id, verdict: "allow_automatic", reason_codes: [] }] };
    const forgedDecision = redigest(forgedDecisionBody);
    assert.throws(() => applyAdaptiveEvolution({ ...base, proposal: forgedProposal, decision: forgedDecision }), /evolution_decision_recomputation_mismatch|automatic_promotion_not_allowed/);

    const unsafeId = redigest({ ...candidate, id: "../../../package" });
    const unsafeDecision = evaluateEvolutionProposal(unsafeId, approvedEnvelope, "2026-09-02T00:00:00.000Z");
    assert.equal(unsafeDecision.verdict, "denied");
    assert.throws(() => applyAdaptiveEvolution({ ...base, proposal: unsafeId, decision: unsafeDecision }), /evolution_proposal_invalid/);
    assert.throws(() => applyAdaptiveEvolution({ ...base, state_ref: "package.json" }), /adaptive_state_ref_invalid/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("failed lease acquisition cannot delete another process lease", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-autonomy-lease-"));
  try {
    const initial = { contract_version: "1.0.0", scope: "demo", revision: 0, records: {}, applied_proposal_ids: [] };
    const approvedEnvelope = envelope();
    const candidate = proposal(digestValue(initial));
    const decision = evaluateEvolutionProposal(candidate, approvedEnvelope, "2026-09-02T00:00:00.000Z");
    const lease = path.join(root, ".mirai/adaptive/state.json.lease");
    fs.mkdirSync(path.dirname(lease), { recursive: true });
    fs.writeFileSync(lease, "other-process-token");
    assert.throws(() => applyAdaptiveEvolution({ root, state_ref: ".mirai/adaptive/state.json", proposal: candidate, decision, envelope: approvedEnvelope, authorization_ref: "authorization.test", verify_authorization: () => true, applied_at: "2026-09-02T00:01:00.000Z" }), /adaptive_state_lease_unavailable/);
    assert.equal(fs.readFileSync(lease, "utf8"), "other-process-token");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
