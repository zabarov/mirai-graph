const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const { programDigest } = require("../../dist/cjs/program");
const { RunStore, createApprovalReceipt, startGovernedRun, buildSanitizedEvidence, inspectRuntimeHealth } = require("../../dist/cjs/runtime");

function schema(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", name), "utf8"));
}

function readProgram() {
  const readType = { kind: "record", fields: { path: "string", encoding: "string", content: "string", size: "int64", sha256: "string" } };
  const nodes = [
    {
      id: "read.file", kind: "call", target: { kind: "adapter", adapter: "repository", operation: "read_file" },
      args: { path: { op: "literal", value: "note.txt" } }, result: "read_result",
      effects: ["repository_read"], capability: "capability.repository.read", next: "return.done"
    },
    { id: "return.done", kind: "return", values: { status: { op: "literal", value: "done" } } }
  ];
  const value = {
    contract_version: "1.0.0", id: "program.schema-read", version: "1.0.0", imports: [], inputs: [],
    outputs: [{ id: "status", type: "string" }],
    state: [{ id: "read_result", type: readType, default: { path: "pending", encoding: "utf8", content: "", size: 0, sha256: "pending" } }],
    nodes, entry: "read.file", error_routes: [],
    policies: { budgets: { max_steps: 16, max_depth: 8, max_iterations: 8, max_parallel: 4, max_duration_ms: 100 }, allowed_effects: ["repository_read"], canonical_write_allowed: false },
    source_map: Object.fromEntries(nodes.map((node) => [node.id, { file: "test:schema" }]))
  };
  return { ...value, digest: programDigest(value) };
}

test("runtime contracts validate reference host-local artifacts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-runtime-schema-"));
  const sandbox = path.join(root, "sandbox");
  const store = new RunStore(path.join(root, "home"));
  fs.mkdirSync(sandbox);
  fs.writeFileSync(path.join(sandbox, "note.txt"), "schema fixture");
  const program = readProgram();
  const result = await startGovernedRun(program, {}, { store, sandbox });
  const directory = store.directory(result.run.run_id);
  const artifacts = {
    "mirai-runtime-run.schema.json": store.readRun(result.run.run_id),
    "mirai-runtime-checkpoint.schema.json": store.readCheckpoint(result.run.run_id),
    "mirai-governed-episode.schema.json": store.readEpisode(result.run.run_id),
    "mirai-effect-receipt.schema.json": store.listReceipts(result.run.run_id)[0],
    "mirai-capability-request.schema.json": JSON.parse(fs.readFileSync(path.join(directory, "capability-requests", fs.readdirSync(path.join(directory, "capability-requests"))[0]), "utf8")),
    "mirai-capability-grant.schema.json": JSON.parse(fs.readFileSync(path.join(directory, "capabilities", fs.readdirSync(path.join(directory, "capabilities"))[0]), "utf8")),
    "mirai-policy-decision.schema.json": JSON.parse(fs.readFileSync(path.join(directory, "policy-decisions", fs.readdirSync(path.join(directory, "policy-decisions"))[0]), "utf8")),
    "mirai-sanitized-evidence.schema.json": buildSanitizedEvidence(result.run.run_id, store),
    "mirai-runtime-health.schema.json": inspectRuntimeHealth(store.home)
  };
  for (const [name, artifact] of Object.entries(artifacts)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema(name));
    assert.equal(validate(artifact), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }

  const approval = createApprovalReceipt({
    home: store.home,
    program_digest: program.digest,
    sandbox,
    effects: ["workspace_patch"],
    approver: "schema.owner"
  });
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateApproval = ajv.compile(schema("mirai-approval-receipt.schema.json"));
  assert.equal(validateApproval(approval), true, JSON.stringify(validateApproval.errors));
});
