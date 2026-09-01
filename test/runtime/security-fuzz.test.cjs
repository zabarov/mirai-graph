const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { REFERENCE_ADAPTERS, resolveSandboxPath } = require("../../dist/cjs/adapters");
const {
  DEFAULT_CAPABILITY_POLICY,
  ReferenceCapabilityProvider,
  buildCapabilityRequest,
  policyDigest,
  validateGrant
} = require("../../dist/cjs/runtime");

function temporarySandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-security-fuzz-"));
  const sandbox = path.join(root, "sandbox");
  fs.mkdirSync(sandbox);
  fs.writeFileSync(path.join(root, "outside.txt"), "outside");
  fs.writeFileSync(path.join(sandbox, "inside.txt"), "inside");
  return { root, sandbox };
}

test("bounded path fuzz rejects traversal, absolute paths and symlink escapes", () => {
  const { root, sandbox } = temporarySandbox();
  for (let depth = 1; depth <= 100; depth += 1) {
    const candidate = `${"../".repeat(depth)}outside.txt`;
    assert.throws(() => resolveSandboxPath(sandbox, candidate), /path_traversal_forbidden/);
  }
  for (const candidate of [path.join(root, "outside.txt"), path.resolve("/tmp"), `${path.sep}etc${path.sep}passwd`]) {
    assert.throws(() => resolveSandboxPath(sandbox, candidate), /absolute_path_forbidden/);
  }
  if (process.platform !== "win32") {
    fs.symlinkSync(path.join(root, "outside.txt"), path.join(sandbox, "outside-link"));
    assert.throws(() => resolveSandboxPath(sandbox, "outside-link"), /symlink_path_forbidden/);
  }
  assert.equal(resolveSandboxPath(sandbox, "inside.txt"), path.join(sandbox, "inside.txt"));
});

test("generated command identifiers cannot escape the host allowlist", async () => {
  const context = {
    run_id: "run.fuzz",
    node_id: "node.fuzz",
    sandbox: process.cwd(),
    idempotency_key: "idempotency.fuzz",
    max_bytes: 4096,
    test_commands: {},
    store: {}
  };
  const metacharacters = [";", "&&", "||", "|", "`", "$(", "\n", "../"];
  for (let index = 0; index < 100; index += 1) {
    const commandId = `fixture${metacharacters[index % metacharacters.length]}payload-${index}`;
    await assert.rejects(
      () => REFERENCE_ADAPTERS.test.run.execute({ command_id: commandId }, context),
      /test_command_not_allowlisted/
    );
  }
});

test("generated cross-run and scope mutations invalidate capability grants", () => {
  const { sandbox } = temporarySandbox();
  const request = buildCapabilityRequest({
    run_id: "run.expected",
    program_digest: `sha256:${"a".repeat(64)}`,
    node_id: "node.read",
    adapter: "repository",
    action: "read_file",
    resource: ".",
    effects: ["repository_read"],
    capability: "capability.repository.read",
    budget: { max_calls: 1, max_bytes: 4096 },
    policy_digest: policyDigest(DEFAULT_CAPABILITY_POLICY),
    approval_required: false
  });
  const decision = new ReferenceCapabilityProvider(DEFAULT_CAPABILITY_POLICY, {
    home: sandbox,
    sandbox,
    apply: false
  }).request(request);
  assert(decision.grant);
  assert.deepEqual(validateGrant(decision.grant, request), []);

  for (let index = 0; index < 100; index += 1) {
    const crossRun = { ...decision.grant, run_id: `run.other-${index}` };
    assert(validateGrant(crossRun, request).includes("grant_cross_run_reuse"));
    const wrongNode = { ...decision.grant, node_id: `node.other-${index}` };
    assert(validateGrant(wrongNode, request).includes("grant_program_scope_mismatch"));
    const wrongResource = { ...decision.grant, resource: `../outside-${index}` };
    assert(validateGrant(wrongResource, request).includes("grant_operation_scope_mismatch"));
  }
});
