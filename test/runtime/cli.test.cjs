const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const packageVersion = require(path.join(root, "package.json")).version;
const cli = path.join(root, "packages/cli/mirai.js");
const fixture = path.join(root, "examples/mirai-governed-runtime-minimal");

function command(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", ...options });
}

test("primary CLI exposes Mirai 2.1 help and package version while preserving legacy routing", () => {
  const help = command(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stderr, /Mirai 2\.1 CLI \(stable\)/);
  const version = command(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), packageVersion);
  const legacy = command(["validate", path.join(root, "examples/minimal-graph")]);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).valid, true);
});

test("CLI run, inspect, replay and sanitized evidence form a closed workflow", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-cli-runtime-"));
  const home = path.join(temp, "home");
  const output = path.join(temp, "evidence");
  const program = path.join(fixture, "results/program.mirai.json");
  const input = path.join(fixture, "input.json");
  const sandbox = path.join(fixture, "sandbox");
  const run = command(["run", program, "--input", input, "--sandbox", sandbox, "--home", home, "--run-id", "run.cli-test"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).run.status, "completed");

  const inspect = command(["inspect", "run.cli-test", "--home", home]);
  assert.equal(inspect.status, 0, inspect.stderr);
  assert(!inspect.stdout.includes("Synthetic repository note"));
  assert(!inspect.stdout.includes(sandbox));

  const replay = command(["replay", "run.cli-test", "--program", program, "--home", home]);
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "match");

  const evidence = command(["evidence", "export", "run.cli-test", "--out", output, "--home", home]);
  assert.equal(evidence.status, 0, evidence.stderr);
  const exported = fs.readFileSync(path.join(output, "mirai-evidence.json"), "utf8");
  assert(!exported.includes("Synthetic repository note"));
  assert(!exported.includes("opaque_token"));
  assert(!exported.includes(sandbox));
});

test("CLI refuses YAML as runtime input", () => {
  const result = command([
    "run", path.join(fixture, "program.mirai.yaml"),
    "--input", path.join(fixture, "input.json"),
    "--sandbox", path.join(fixture, "sandbox")
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compiled \.mirai\.json IR only/);
});

test("operations status is read-only for an absent home", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-operations-empty-"));
  const home = path.join(temp, "missing-home");
  const result = command(["operations", "status", "--home", home]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "empty");
  assert.equal(report.sensitive_data_exposed, false);
  assert.equal(report.canonical_write_allowed, false);
  assert.equal(fs.existsSync(home), false);
});

test("operations status exposes recovery need without sensitive runtime fields", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-operations-blocked-"));
  const home = path.join(temp, "home");
  const { RunStore } = require("../../dist/cjs/runtime");
  const program = JSON.parse(fs.readFileSync(path.join(fixture, "results/program.mirai.json"), "utf8"));
  const store = new RunStore(home);
  store.createRun({ program, input: {}, sandbox: path.join(temp, "sandbox"), apply: false, run_id: "run.operations-uncertain" });
  store.writeReceipt("run.operations-uncertain", {
    contract_version: "1.0.0",
    receipt_id: "receipt.operations-uncertain",
    sequence: 1,
    idempotency_key: "idempotency.operations-uncertain",
    run_id: "run.operations-uncertain",
    program_id: program.id,
    program_digest: program.digest,
    node_id: "node.synthetic",
    invocation_id: "invocation.synthetic",
    adapter: "synthetic",
    operation: "read",
    effects: ["repository_read"],
    capability_grant_ref: "host-local://capabilities/redacted",
    args_digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    status: "uncertain",
    attempt: 1,
    prepared_at: "2026-09-01T00:00:00Z"
  });
  const result = command(["operations", "status", "--home", home]);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.recovery_required_runs, ["run.operations-uncertain"]);
  assert(!result.stdout.includes("capability_grant_ref"));
  assert(!result.stdout.includes(path.join(temp, "sandbox")));
});

test("operations mutation-lock recovery requires confirmation and preserves quarantine", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-operations-lock-recovery-"));
  const home = path.join(temp, "home");
  const { RunStore } = require("../../dist/cjs/runtime");
  const program = JSON.parse(fs.readFileSync(path.join(fixture, "results/program.mirai.json"), "utf8"));
  const store = new RunStore(home);
  store.createRun({ program, input: {}, sandbox: path.join(temp, "sandbox"), apply: false, run_id: "run.operations-lock" });
  const lock = path.join(store.directory("run.operations-lock"), "mutation.lock");
  fs.mkdirSync(lock, { mode: 0o700 });
  const exited = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  assert.equal(exited.status, 0, exited.stderr);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ token: "dead-owner", pid: Number(exited.stdout), acquired_at: "2000-01-01T00:00:00.000Z" }));

  const unconfirmed = command(["operations", "recover-mutation-lock", "run.operations-lock", "--minimum-age-ms", "1", "--home", home]);
  assert.equal(unconfirmed.status, 1);
  assert.match(unconfirmed.stderr, /mutation_lock_recovery_confirmation_required/);
  const recovered = command(["operations", "recover-mutation-lock", "run.operations-lock", "--minimum-age-ms", "1", "--confirm-stale-lock-recovery", "--home", home]);
  assert.equal(recovered.status, 0, recovered.stderr);
  const result = JSON.parse(recovered.stdout);
  assert.equal(result.status, "mutation_lock_recovered");
  assert.equal(result.canonical_write_allowed, false);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(fs.existsSync(path.join(store.directory("run.operations-lock"), `${result.recovery_id}.quarantine`, "owner.json")), true);
});
