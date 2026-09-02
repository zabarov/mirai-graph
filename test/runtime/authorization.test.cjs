const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const { digestValue } = require("../../dist/cjs/core");
const { programDigest } = require("../../dist/cjs/program");
const {
  DEFAULT_CAPABILITY_POLICY,
  ReferenceCapabilityProvider,
  RunStore,
  buildCapabilityRequest,
  createLayeredInvariantSet,
  createMandateReceipt,
  evaluateLayeredInvariants,
  policyDigest,
  revokeMandateReceipt,
  startGovernedRun
} = require("../../dist/cjs/runtime");

function request(overrides = {}) {
  return buildCapabilityRequest({
    run_id: "run.authorization",
    program_digest: "sha256:" + "1".repeat(64),
    input_digest: digestValue({}),
    args_digest: digestValue({ path: "note.txt" }),
    node_id: "read.note",
    adapter: "repository",
    action: "read_file",
    resource: "./note.txt",
    effects: ["repository_read"],
    capability: "capability.repository.read",
    budget: { max_calls: 1, max_bytes: 1024, timeout_ms: 1000 },
    policy_digest: policyDigest(DEFAULT_CAPABILITY_POLICY),
    approval_required: false,
    ...overrides
  });
}

function scopeFor(value) {
  const { contract_version: _contract, request_id: _id, request_digest: _digest, approval_required: _approval, ...scope } = value;
  return scope;
}

function allowSet() {
  return createLayeredInvariantSet({
    id: "invariants.reference-read",
    version: "1.0.0",
    rules: [{
      id: "invariant.system.reference-read",
      layer: "system",
      decision: "allow",
      protected: true,
      adapters: ["repository"],
      operations: ["read_file"],
      effects: ["repository_read"],
      resource_prefixes: ["."],
      reason: "Reference repository reads are allowed in this bounded scope."
    }]
  });
}

function mandate(home, value, options = {}) {
  return createMandateReceipt({
    home,
    subject: "agent.reference",
    issuer: "owner.reference",
    run_id: value.run_id,
    program_digest: value.program_digest,
    input_digest: value.input_digest,
    policy_digest: value.policy_digest,
    request_scopes: [scopeFor(value)],
    ...options
  });
}

test("capability issuance requires an exact active mandate when enabled", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-mandate-"));
  const value = request();
  const active = mandate(home, value);
  const provider = new ReferenceCapabilityProvider(DEFAULT_CAPABILITY_POLICY, {
    home,
    sandbox: home,
    apply: false,
    authorization: { mandate_required: true, invariant_match_required: true, mandate: active, invariant_sets: [allowSet()] }
  });
  const result = provider.request(value);
  assert.equal(result.decision.decision, "granted");
  assert.match(result.grant.mandate_ref, /mandate\./);
  assert.match(result.grant.invariant_evaluation_digest, /^sha256:/);

  const missing = new ReferenceCapabilityProvider(DEFAULT_CAPABILITY_POLICY, {
    home, sandbox: home, apply: false,
    authorization: { mandate_required: true, invariant_match_required: false, invariant_sets: [] }
  }).request(value);
  assert.equal(missing.decision.decision, "denied");
  assert(missing.decision.reasons.includes("mandate_required"));

  const revoked = revokeMandateReceipt(active, { home, revocation_ref: "revocation.owner-request" });
  const denied = new ReferenceCapabilityProvider(DEFAULT_CAPABILITY_POLICY, {
    home, sandbox: home, apply: false,
    authorization: { mandate_required: true, invariant_match_required: false, mandate: revoked, invariant_sets: [] }
  }).request(value);
  assert.equal(denied.decision.decision, "denied");
  assert(denied.decision.reasons.includes("mandate_revoked"));
});

test("mandate signing home rejects an ancestor symlink", () => {
  if (process.platform === "win32") return;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-mandate-home-boundary-"));
  const realParent = path.join(root, "real-parent");
  const linkedParent = path.join(root, "linked-parent");
  fs.mkdirSync(realParent);
  fs.symlinkSync(realParent, linkedParent, "dir");
  assert.throws(() => mandate(path.join(linkedParent, "home"), request()), /mandate_home_symlink_forbidden/);
});

test("mandate is exact, expiring and host-signed", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-mandate-exact-"));
  const value = request();
  const expired = mandate(home, value, { ttl_ms: 1, now: new Date("2026-01-01T00:00:00.000Z") });
  const provider = (receipt) => new ReferenceCapabilityProvider(DEFAULT_CAPABILITY_POLICY, {
    home, sandbox: home, apply: false,
    authorization: { mandate_required: true, invariant_match_required: false, mandate: receipt, invariant_sets: [] }
  });
  assert(provider(expired).request(value, new Date("2026-01-01T00:00:01.000Z")).decision.reasons.includes("mandate_expired"));
  const active = mandate(home, value);
  assert(provider(active).request(request({ resource: "./other.txt" })).decision.reasons.includes("mandate_request_scope_mismatch"));
  assert(provider({ ...active, subject: "forged" }).request(value).decision.reasons.includes("mandate_signature_invalid"));
});

test("any applicable deny blocks lower-layer allow", () => {
  const value = request();
  const invariants = createLayeredInvariantSet({
    id: "invariants.layered",
    version: "1.0.0",
    rules: [
      { id: "invariant.system.deny", layer: "system", decision: "deny", protected: true, adapters: ["repository"], operations: ["read_file"], effects: ["repository_read"], resource_prefixes: ["."], reason: "System boundary denies this read." },
      { id: "invariant.task.allow", layer: "task", decision: "allow", protected: false, adapters: ["repository"], operations: ["read_file"], effects: ["repository_read"], resource_prefixes: ["."], reason: "Task would otherwise allow it." }
    ]
  });
  const result = evaluateLayeredInvariants(value, [invariants]);
  assert.equal(result.decision, "denied");
  assert.deepEqual(result.denied_rule_ids, ["invariant.system.deny"]);
  assert(result.protected_rule_ids.includes("invariant.system.deny"));
  assert.equal(evaluateLayeredInvariants(value, [{ ...invariants, digest: "sha256:" + "0".repeat(64) }]).decision, "denied");
});

test("governed runtime persists and enforces opt-in authorization context", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-authorized-run-"));
  const sandbox = path.join(root, "sandbox");
  const store = new RunStore(path.join(root, "home"));
  fs.mkdirSync(sandbox);
  fs.writeFileSync(path.join(sandbox, "note.txt"), "authorized");
  const nodes = [
    { id: "read.note", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read_file" }, args: { path: { op: "literal", value: "note.txt" } }, result: "read_result", effects: ["repository_read"], capability: "capability.repository.read", next: "return.done" },
    { id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } }
  ];
  const base = {
    contract_version: "1.0.0", id: "program.authorized-read", version: "1.0.0", imports: [], inputs: [],
    outputs: [{ id: "status", type: "string" }],
    state: [{ id: "read_result", type: { kind: "record", fields: { path: "string", encoding: "string", content: "string", size: "int64", sha256: "string" } }, default: { path: "", encoding: "utf8", content: "", size: 0, sha256: "" } }],
    nodes, entry: "read.note", error_routes: [],
    policies: { budgets: { max_steps: 8, max_depth: 4, max_iterations: 4, max_parallel: 2, max_duration_ms: 1000 }, allowed_effects: ["repository_read"], canonical_write_allowed: false },
    source_map: Object.fromEntries(nodes.map((node) => [node.id, { file: "test:authorization" }]))
  };
  const program = { ...base, digest: programDigest(base) };
  const runId = "run.authorization-runtime";
  const exactRequest = buildCapabilityRequest({
    run_id: runId,
    program_digest: program.digest,
    input_digest: digestValue({}),
    args_digest: digestValue({ path: "note.txt" }),
    node_id: "read.note",
    adapter: "repository",
    action: "read_file",
    resource: "./note.txt",
    effects: ["repository_read"],
    capability: "capability.repository.read",
    budget: { max_calls: 1, max_bytes: 1_000_000, timeout_ms: 30_000 },
    policy_digest: policyDigest(DEFAULT_CAPABILITY_POLICY),
    approval_required: false
  });
  const authorization = {
    mandate_required: true,
    invariant_match_required: true,
    mandate: mandate(store.home, exactRequest),
    invariant_sets: [allowSet()]
  };
  const result = await startGovernedRun(program, {}, { store, sandbox, run_id: runId, authorization });
  assert.equal(result.run.status, "completed");
  assert.equal(result.episode.effects_executed, true);
  const config = store.readRuntimeConfig(runId);
  assert.equal(config.authorization.mandate.mandate_id, authorization.mandate.mandate_id);
});

test("mandate and invariant artifacts conform to public schemas", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-authorization-schema-"));
  const value = request();
  const artifacts = {
    "mirai-mandate-receipt.schema.json": mandate(home, value),
    "mirai-layered-invariant-set.schema.json": allowSet(),
    "mirai-invariant-evaluation.schema.json": evaluateLayeredInvariants(value, [allowSet()])
  };
  for (const [name, artifact] of Object.entries(artifacts)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", name), "utf8"));
    const validate = ajv.compile(schema);
    assert.equal(validate(artifact), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
});
